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
            "rule_id": execution_data.get("rule_id"),
            "job_execution_id": job_id,  # Using job_id as execution_id for now
            "status": execution_data.get("status", "failed"),
            "records_checked": execution_data.get("records_checked", 0),
            "records_passed": execution_data.get("records_passed", 0),
            "records_failed": execution_data.get("records_failed", 0),
            "pass_percentage": execution_data.get("pass_percentage", 0.0),
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
            "column_name": rule["column_name"],
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
    merge_strategy: str = "versioned",
    custom_table_name: str | None = None,
) -> tuple[str, str, str]:
    """
    Return (current_filename, current_key, archive_key) for the silver layer.

    Merge strategies:
    - "versioned" (default): Include run_id for unique versioned files
      Pattern: silver/{tableName}/{yyyymmdd}/{tableName}_{runId}.parquet
    - "merge" or "replace": Use fixed filename for merge/replace operations
      Pattern: silver/{tableName}/{yyyymmdd}/{tableName}_current.parquet

    Human-friendly naming:
    - Uses user-configured table name if provided (e.g., "loan_payments_silver")
    - Falls back to workflow_slug_job_slug pattern
    - Clean version numbering in archive
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    # Use custom table name if provided, otherwise use workflow_slug_job_slug
    base_name = custom_table_name if custom_table_name else f"{workflow_slug}_{job_slug}"
    # Also use for folder structure
    folder_name = custom_table_name if custom_table_name else f"{workflow_slug}/{job_slug}"

    if merge_strategy in ("merge", "replace"):
        # Fixed filename for merge/replace - enables actual merge behavior
        current_filename = f"{base_name}_current.parquet"
    else:
        # Versioned filename (default) - each run creates a new file
        current_filename = f"{base_name}_{run_id}.parquet"

    current_key = f"silver/{folder_name}/{date_folder}/{current_filename}"

    # Archive: we'll determine version dynamically, for now use v001
    archive_filename = f"{timestamp}_v001.parquet"
    archive_key = f"silver/{folder_name}/{date_folder}/archive/{archive_filename}"

    return current_filename, current_key, archive_key


@task(name="silver_transform")
def silver_transform(
    bronze_result: dict,
    *,
    primary_keys: list[str] | None = None,
    silver_config: dict | None = None,
    destination_config: dict | None = None,
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
    environment = bronze_result.get("environment", "prod")

    # Extract silver config
    silver_config = silver_config or {}
    destination_config = destination_config or {}
    merge_strategy = silver_config.get("mergeStrategy", "versioned")
    custom_table_name = silver_config.get("tableName")

    logger.info(f"Silver config: mergeStrategy={merge_strategy}, tableName={custom_table_name}")

    current_filename, current_key, archive_key = _build_silver_keys(
        workflow_slug, job_slug, run_id, merge_strategy=merge_strategy,
        custom_table_name=custom_table_name,
    )

    logger.info("Transforming Bronze dataset %s to Silver (table: %s)", bronze_key, custom_table_name or "auto")

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

        # Handle merge strategy: load existing Silver data and merge on primary key
        if merge_strategy == "merge" and s3.object_exists(current_key):
            logger.info(f"Merge mode: Loading existing Silver data from {current_key}")
            existing_silver = tmp_path / "existing_silver.parquet"
            s3.download_file(current_key, existing_silver)
            existing_df = read_parquet(existing_silver)
            logger.info(f"Existing Silver data: {existing_df.height} rows")

            if primary_keys:
                # Merge: Update existing records by primary key, add new records
                # Remove _sk_id from existing data before merge (will be regenerated)
                if "_sk_id" in existing_df.columns:
                    existing_df = existing_df.drop("_sk_id")

                # Use anti-join to find records in existing that are NOT in new data
                # Then concatenate with new data (new data takes precedence)
                existing_only = existing_df.join(
                    df.select(primary_keys),
                    on=primary_keys,
                    how="anti"
                )
                df = pl.concat([existing_only, df], how="diagonal")
                logger.info(f"After merge: {df.height} total rows (existing not in new: {existing_only.height}, new: {df.height - existing_only.height})")
            else:
                # No primary key - just append (same as append mode)
                if "_sk_id" in existing_df.columns:
                    existing_df = existing_df.drop("_sk_id")
                df = pl.concat([existing_df, df], how="diagonal")
                logger.info(f"After merge (no PK, appending): {df.height} total rows")

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
        # Get user-configured table names from silver_config
        custom_silver_table = silver_config.get("tableName") if silver_config else None
        # Get parent bronze table name from bronze config (passed through bronze_result or use auto-generated)
        bronze_config = destination_config.get("bronzeConfig", {}) if destination_config else {}
        parent_bronze_table = bronze_config.get("tableName") or f"{job_slug}_bronze"

        asset_id = catalog_silver_asset(
            source_id=job_id,  # job_id is actually the source ID
            workflow_slug=workflow_slug,
            source_slug=job_slug,
            s3_key=current_key,
            row_count=df.height,
            dataframe=df,
            parent_bronze_table=parent_bronze_table,
            environment=environment,
            custom_table_name=custom_silver_table,
        )
        logger.info(f"✅ Silver metadata cataloged: {asset_id} (table: {custom_silver_table or 'auto-generated'})")
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
        "environment": environment,
    }
