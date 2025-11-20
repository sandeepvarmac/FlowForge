from __future__ import annotations

import argparse
import sys
from pathlib import Path
from typing import List, Optional

from prefect import flow, get_run_logger

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from tasks.bronze import bronze_ingest  # noqa: E402
from tasks.database_bronze import ingest_from_database  # noqa: E402
from tasks.gold import gold_publish  # noqa: E402
from tasks.silver import silver_transform  # noqa: E402
from utils.slugify import slugify, generate_run_id  # noqa: E402
from services.trigger_handler import notify_completion  # noqa: E402


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the FlowForge medallion pipeline locally.")
    parser.add_argument("workflow_id", help="Workflow identifier (used for S3 paths)")
    parser.add_argument("job_id", help="Job identifier (used for S3 paths)")
    parser.add_argument("workflow_name", help="Workflow name (for slug generation)")
    parser.add_argument("job_name", help="Job name (for slug generation)")
    parser.add_argument("landing_key", help="S3 key under landing/ that points to the source CSV")
    parser.add_argument(
        "--primary-keys",
        nargs="*",
        default=None,
        help="Optional primary key columns for Silver deduplication",
    )
    return parser.parse_args()


@flow(name="flowforge-medallion")
def medallion_pipeline(
    workflow_id: str,
    job_id: str,
    workflow_name: str,
    job_name: str,
    landing_key: str = None,
    primary_keys: Optional[List[str]] = None,
    column_mappings: Optional[List[dict]] = None,
    has_header: bool = True,
    flow_run_id: Optional[str] = None,
    file_format: str = "csv",
    file_options: Optional[dict] = None,
    execution_id: Optional[str] = None,
    source_type: str = "file",
    source_config: Optional[dict] = None,
    destination_config: Optional[dict] = None,
    batch_id: Optional[str] = None,
) -> dict:
    """Execute the Bronze → Silver → Gold pipeline with human-readable S3 keys.

    Supports file-based ingestion (CSV, JSON, Parquet, Excel) and database ingestion
    (SQL Server, PostgreSQL, MySQL).

    Args:
        workflow_id: Workflow identifier
        job_id: Job identifier
        workflow_name: Workflow name
        job_name: Job name
        landing_key: S3 key for source data (file-based jobs only)
        primary_keys: Primary keys for deduplication
        column_mappings: Column mappings
        has_header: Whether file has headers
        flow_run_id: Prefect flow run ID
        file_format: File format (csv, json, parquet, excel)
        file_options: File-specific options
        execution_id: FlowForge execution ID (for dependency triggers)
        source_type: Source type ("file" or "database")
        source_config: Database connection config (database jobs only)
        destination_config: Bronze layer config (database jobs only)
        batch_id: Batch identifier (database jobs only)
    """
    logger = get_run_logger()

    # Generate human-readable slugs
    workflow_slug = slugify(workflow_name)
    job_slug = slugify(job_name)
    run_id = generate_run_id(flow_run_id)

    logger.info(
        "Starting medallion pipeline for workflow=%s job=%s source_type=%s (slugs: %s/%s, run: %s, execution: %s)",
        workflow_id,
        job_id,
        source_type,
        workflow_slug,
        job_slug,
        run_id,
        execution_id or "N/A",
    )

    # Track execution status for dependency triggers
    execution_status = "failed"
    result = None

    try:
        # Route to appropriate bronze ingestion task based on source type
        if source_type == "database":
            logger.info("Database job detected - using database_bronze task")
            bronze_result = ingest_from_database(
                workflow_id=workflow_id,
                job_id=job_id,
                workflow_slug=workflow_slug,
                job_slug=job_slug,
                run_id=run_id,
                source_config=source_config,
                destination_config=destination_config,
                batch_id=batch_id or run_id,
                execution_id=execution_id,
            )
        else:
            logger.info("File job detected - using bronze_ingest task")
            bronze_result = bronze_ingest(
                workflow_id=workflow_id,
                job_id=job_id,
                workflow_slug=workflow_slug,
                job_slug=job_slug,
                run_id=run_id,
                landing_key=landing_key,
                file_format=file_format,
                file_options=file_options,
                column_mappings=column_mappings,
                has_header=has_header,
            )

        silver_result = silver_transform(bronze_result, primary_keys=primary_keys)
        gold_result = gold_publish(silver_result)

        result = {
            "bronze": bronze_result,
            "silver": silver_result,
            "gold": gold_result,
        }

        # Mark as completed
        execution_status = "completed"
        logger.info("Medallion pipeline completed successfully")

        return result

    except Exception as e:
        logger.error(f"Medallion pipeline failed: {e}")
        execution_status = "failed"
        raise

    finally:
        # Notify completion to trigger dependent workflows
        if execution_id:
            try:
                logger.info(
                    f"Notifying execution completion: {execution_id}, status: {execution_status}"
                )
                trigger_result = notify_completion(
                    execution_id=execution_id,
                    workflow_id=workflow_id,
                    status=execution_status
                )
                logger.info(
                    f"Triggered {trigger_result.get('triggeredCount', 0)} dependent workflows"
                )
            except Exception as trigger_error:
                # Don't fail the flow if trigger notification fails
                logger.warning(
                    f"Failed to notify execution completion: {trigger_error}"
                )


if __name__ == "__main__":
    args = _parse_args()
    medallion_pipeline(
        workflow_id=args.workflow_id,
        job_id=args.job_id,
        workflow_name=args.workflow_name,
        job_name=args.job_name,
        landing_key=args.landing_key,
        primary_keys=args.primary_keys,
    )
