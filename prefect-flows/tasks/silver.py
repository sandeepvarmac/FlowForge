from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.parquet_utils import (
    add_surrogate_key,
    deduplicate,
    read_parquet,
    write_parquet,
)
from utils.s3 import S3Client
from utils.metadata_catalog import catalog_silver_asset, update_job_execution_metrics
from utils.quality_executor import QualityRuleExecutor
import os
import requests
import json


def _load_quality_rules(job_id: str, logger) -> list:
    """
    Load active quality rules for a job from the database via API

    Args:
        job_id: FlowForge job ID
        logger: Prefect logger

    Returns:
        List of quality rule dictionaries
    """
    api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
    api_url = f"{api_base_url}/api/quality/rules?job_id={job_id}"

    try:
        response = requests.get(api_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            rules = data.get("rules", [])
            logger.info(f"Loaded {len(rules)} quality rules for job {job_id}")
            return rules
        else:
            logger.warning(f"Failed to load quality rules: HTTP {response.status_code}")
            return []
    except Exception as e:
        logger.warning(f"Error loading quality rules: {e}")
        return []


def _save_rule_execution(job_id: str, execution_data: dict, logger):
    """
    Save quality rule execution results to database via API

    Args:
        job_id: FlowForge job ID
        execution_data: Execution result data
        logger: Prefect logger
    """
    api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
    api_url = f"{api_base_url}/api/quality/executions"

    try:
        payload = {
            "rule_id": execution_data["rule_id"],
            "job_execution_id": job_id,  # Using job_id as execution_id for now
            "status": execution_data["status"],
            "records_checked": execution_data["records_checked"],
            "records_passed": execution_data["records_passed"],
            "records_failed": execution_data["records_failed"],
            "pass_percentage": execution_data["pass_percentage"],
            "failed_records_sample": json.dumps(execution_data.get("failed_records_sample", [])),
            "error_message": execution_data.get("error_message"),
        }

        response = requests.post(api_url, json=payload, timeout=10)
        if response.status_code == 200:
            logger.info(f"   ✓ Saved execution result for rule: {execution_data['rule_id']}")
        else:
            logger.warning(f"   ✗ Failed to save execution: HTTP {response.status_code}")

    except Exception as e:
        logger.warning(f"   ✗ Error saving execution result: {e}")


def _save_quarantined_records(job_id: str, rule_execution_id: str, quarantined_records: list, rule_name: str, logger):
    """
    Save quarantined records to database via API

    Args:
        job_id: FlowForge job ID
        rule_execution_id: Rule execution ID
        quarantined_records: List of failed records
        rule_name: Name of the rule that failed
        logger: Prefect logger
    """
    api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
    api_url = f"{api_base_url}/api/quality/quarantine"

    saved_count = 0
    for record in quarantined_records[:100]:  # Limit to 100 records per rule
        try:
            payload = {
                "rule_execution_id": rule_execution_id,
                "job_execution_id": job_id,
                "record_data": json.dumps(record),
                "failure_reason": f"Failed {rule_name}",
                "quarantine_status": "quarantined",
            }

            response = requests.post(api_url, json=payload, timeout=10)
            if response.status_code == 200:
                saved_count += 1

        except Exception as e:
            logger.warning(f"Error saving quarantined record: {e}")
            break

    if saved_count > 0:
        logger.info(f"   Saved {saved_count} quarantined records")


def _execute_quality_rules(job_id: str, df: pl.DataFrame, logger) -> dict:
    """
    Execute quality rules on a DataFrame and quarantine failed records

    Args:
        job_id: FlowForge job ID
        df: Polars DataFrame to validate
        logger: Prefect logger

    Returns:
        Dictionary with execution summary
    """
    # Load quality rules for this job
    rules = _load_quality_rules(job_id, logger)

    if not rules:
        logger.info("No quality rules found for this job")
        return None

    # Convert rules to format expected by QualityRuleExecutor
    executor_rules = []
    for rule in rules:
        # Parse parameters if it's a JSON string
        parameters = rule.get("parameters")
        if isinstance(parameters, str):
            try:
                parameters = json.loads(parameters)
            except:
                parameters = {"value": parameters}  # Wrap simple strings in dict

        executor_rule = {
            "id": rule["id"],
            "rule_id": rule.get("rule_id", rule["id"]),
            "rule_name": rule.get("rule_name", "Unknown Rule"),
            "column": rule["column_name"],
            "rule_type": rule["rule_type"],
            "parameters": parameters,
            "severity": rule.get("severity", "error"),
        }
        executor_rules.append(executor_rule)

    # Execute all rules
    executor = QualityRuleExecutor(executor_rules)
    result = executor.execute_all_rules(df)

    # Save execution results for each rule
    for execution in result["rule_executions"]:
        _save_rule_execution(job_id, execution, logger)

        # Save quarantined records if there are failures
        if execution["records_failed"] > 0 and execution.get("failed_records_sample"):
            _save_quarantined_records(
                job_id=job_id,
                rule_execution_id=execution["rule_id"],
                quarantined_records=execution["failed_records_sample"],
                rule_name=execution.get("rule_name", "Unknown"),
                logger=logger
            )

    return result


def _build_silver_keys(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
) -> tuple[str, str, str]:
    """
    Return (current_filename, current_key, archive_key) for the silver layer.

    Pattern:
      - Current: silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}_{jobSlug}_{runId}.parquet
      - Archive: silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/archive/{timestamp}_v{sequence}.parquet

    Human-friendly naming:
    - Single underscores instead of double
    - No redundant "__silver" or "__current" suffix (current version is the main file)
    - Clean version numbering in archive
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    current_filename = f"{workflow_slug}_{job_slug}_{run_id}.parquet"
    current_key = f"silver/{workflow_slug}/{job_slug}/{date_folder}/{current_filename}"

    # Archive: we'll determine version dynamically, for now use v001
    archive_filename = f"{timestamp}_v001.parquet"
    archive_key = f"silver/{workflow_slug}/{job_slug}/{date_folder}/archive/{archive_filename}"

    return current_filename, current_key, archive_key


@task(name="silver_transform")
def silver_transform(
    bronze_result: dict,
    *,
    primary_keys: list[str] | None = None,
) -> dict:
    """Transform Bronze data into the Silver layer."""
    logger = get_run_logger()
    s3 = S3Client()

    workflow_id = bronze_result["workflow_id"]
    job_id = bronze_result["job_id"]
    workflow_slug = bronze_result["workflow_slug"]
    job_slug = bronze_result["job_slug"]
    run_id = bronze_result["run_id"]
    bronze_key = bronze_result["bronze_key"]

    current_filename, current_key, archive_key = _build_silver_keys(workflow_slug, job_slug, run_id)

    logger.info("Transforming Bronze dataset %s to Silver", bronze_key)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        local_bronze = tmp_path / Path(bronze_key).name
        s3.download_file(bronze_key, local_bronze)

        df = read_parquet(local_bronze)

        if primary_keys:
            df = deduplicate(df, subset=primary_keys, keep="last")
        else:
            df = deduplicate(df, subset=None, keep="last")

        # Execute quality rules before adding surrogate key
        quality_execution_summary = None
        try:
            logger.info("🔍 Executing quality rules...")
            quality_execution_summary = _execute_quality_rules(
                job_id=job_id,
                df=df,
                logger=logger
            )

            if quality_execution_summary:
                logger.info(f"✅ Quality execution complete:")
                logger.info(f"   - Rules executed: {quality_execution_summary['total_rules']}")
                logger.info(f"   - Records passed: {quality_execution_summary['passed_records']}")
                logger.info(f"   - Records quarantined: {quality_execution_summary['failed_records']}")

                # Remove quarantined records from dataframe
                if quality_execution_summary['failed_records'] > 0:
                    failed_indices = quality_execution_summary.get('failed_indices', [])
                    if failed_indices:
                        logger.info(f"   Removing {len(failed_indices)} quarantined records from Silver layer")
                        # Keep only records that passed quality checks
                        mask = [i not in failed_indices for i in range(len(df))]
                        df = df.filter(pl.Series(mask))
                        logger.info(f"   Clean records count: {len(df)}")

        except Exception as e:
            logger.warning(f"⚠️ Quality rule execution failed (non-blocking): {e}")
            import traceback
            logger.warning(traceback.format_exc())

        df = add_surrogate_key(df, key_column="_sk_id", start=1)

        local_silver = tmp_path / "current.parquet"
        write_parquet(df, local_silver)

        # Archive previous Silver, if it exists
        if s3.object_exists(current_key):
            previous_path = tmp_path / "previous_current.parquet"
            s3.download_file(current_key, previous_path)
            s3.upload_file(previous_path, archive_key)
            logger.info("Archived previous Silver dataset to %s", archive_key)

        s3.upload_file(local_silver, current_key)

    logger.info("Silver dataset ready at %s", current_key)

    # Write metadata to catalog
    try:
        parent_bronze_table = f"{workflow_slug}_{job_slug}_bronze"
        asset_id = catalog_silver_asset(
            job_id=job_id,
            workflow_slug=workflow_slug,
            job_slug=job_slug,
            s3_key=current_key,
            row_count=df.height,
            dataframe=df,
            parent_bronze_table=parent_bronze_table,
            environment="prod",
        )
        logger.info(f"✅ Silver metadata cataloged: {asset_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to catalog silver metadata: {e}")

    # Update job execution metrics
    try:
        quarantined_count = 0
        if quality_execution_summary:
            quarantined_count = quality_execution_summary.get('failed_records', 0)

        update_job_execution_metrics(
            job_id=job_id,
            silver_records=df.height,
            quarantined_records=quarantined_count,
        )
        logger.info(f"✅ Updated job execution metrics: silver_records={df.height}, quarantined={quarantined_count}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to update job execution metrics: {e}")

    return {
        "workflow_id": workflow_id,
        "job_id": job_id,
        "workflow_slug": workflow_slug,
        "job_slug": job_slug,
        "run_id": run_id,
        "silver_key": current_key,
        "silver_filename": current_filename,
        "records": df.height,
        "columns": df.columns,
        "bronze_key": bronze_key,
    }
