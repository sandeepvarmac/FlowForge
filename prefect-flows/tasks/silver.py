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


def _build_silver_keys(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
) -> tuple[str, str, str]:
    """
    Return (current_filename, current_key, archive_key) for the silver layer.

    Pattern:
      - Current: silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}__{jobSlug}__{runId}__silver__current.parquet
      - Archive: silver/{workflowSlug}/{jobSlug}/{yyyymmdd}/archive/{timestamp}__v{sequence}.parquet
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    current_filename = f"{workflow_slug}__{job_slug}__{run_id}__silver__current.parquet"
    current_key = f"silver/{workflow_slug}/{job_slug}/{date_folder}/{current_filename}"

    # Archive: we'll determine version dynamically, for now use v001
    archive_filename = f"{timestamp}__v001.parquet"
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
