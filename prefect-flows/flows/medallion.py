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


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the FlowForge medallion pipeline locally.")
    parser.add_argument("workflow_id", help="Workflow identifier (used for S3 paths)")
    parser.add_argument("job_id", help="Job identifier (used for S3 paths)")
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
    landing_key: str,
    primary_keys: Optional[List[str]] = None,
) -> dict:
    """Execute the Bronze → Silver → Gold pipeline."""
    logger = get_run_logger()
    logger.info(
        "Starting medallion pipeline for workflow=%s job=%s landing=%s",
        workflow_id,
        job_id,
        landing_key,
    )

    bronze_result = bronze_ingest(
        workflow_id=workflow_id,
        job_id=job_id,
        landing_key=landing_key,
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
        landing_key=args.landing_key,
        primary_keys=args.primary_keys,
    )
