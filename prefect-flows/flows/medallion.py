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
from tasks.gold import gold_publish  # noqa: E402
from tasks.silver import silver_transform  # noqa: E402
from utils.slugify import slugify, generate_run_id  # noqa: E402


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
    landing_key: str,
    primary_keys: Optional[List[str]] = None,
    column_mappings: Optional[List[dict]] = None,
    has_header: bool = True,
    flow_run_id: Optional[str] = None,
    file_format: str = "csv",
    file_options: Optional[dict] = None,
) -> dict:
    """Execute the Bronze → Silver → Gold pipeline with human-readable S3 keys.

    Supports CSV, JSON, Parquet, and Excel files via pluggable handler framework.
    """
    logger = get_run_logger()

    # Generate human-readable slugs
    workflow_slug = slugify(workflow_name)
    job_slug = slugify(job_name)
    run_id = generate_run_id(flow_run_id)

    logger.info(
        "Starting medallion pipeline for workflow=%s job=%s landing=%s (slugs: %s/%s, run: %s)",
        workflow_id,
        job_id,
        landing_key,
        workflow_slug,
        job_slug,
        run_id,
    )

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

    return {
        "bronze": bronze_result,
        "silver": silver_result,
        "gold": gold_result,
    }


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
