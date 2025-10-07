from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

# TODO: Re-enable DuckDB when installed
# from utils.duckdb_helper import (
#     create_snowflake_schema,
#     export_query_to_parquet,
#     get_connection,
#     load_dimension,
# )
from utils.parquet_utils import read_parquet, write_parquet
from utils.s3 import S3Client


def _build_gold_key(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    domain: str = "analytics",
) -> tuple[str, str]:
    """
    Return (filename, s3_key) for the gold layer.

    Pattern: gold/{domain}/{dataset}/{yyyymmdd}/{dataset}__{runId}__gold__view.parquet

    For now, we use the job_slug as the dataset name.
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    dataset = job_slug  # e.g., "ingest-countries" becomes the dataset name

    filename = f"{dataset}__{run_id}__gold__view.parquet"
    s3_key = f"gold/{domain}/{dataset}/{date_folder}/{filename}"

    return filename, s3_key


@task(name="gold_publish")
def gold_publish(silver_result: dict, domain: str = "analytics") -> dict:
    """Publish analytics outputs to the Gold layer (simplified - no DuckDB for now)."""

    logger = get_run_logger()
    s3 = S3Client()

    workflow_id = silver_result["workflow_id"]
    job_id = silver_result["job_id"]
    workflow_slug = silver_result["workflow_slug"]
    job_slug = silver_result["job_slug"]
    run_id = silver_result["run_id"]
    silver_key = silver_result["silver_key"]

    # Simplified: Just copy Silver to Gold with compression
    logger.info(f"Publishing Gold layer from Silver: {silver_key}")

    gold_filename, gold_key = _build_gold_key(workflow_slug, job_slug, run_id, domain)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        silver_file = tmp_path / "silver.parquet"
        gold_file = tmp_path / gold_filename

        # Download Silver file
        s3.download_file(silver_key, str(silver_file))

        # Read and re-write with ZSTD compression
        df = read_parquet(str(silver_file))
        write_parquet(df, str(gold_file))

        # Upload to Gold layer
        s3.upload_file(str(gold_file), gold_key)

        logger.info(f"✅ Gold layer published: {gold_key} ({len(df)} rows)")

        return {
            "workflow_id": workflow_id,
            "job_id": job_id,
            "workflow_slug": workflow_slug,
            "job_slug": job_slug,
            "run_id": run_id,
            "gold_key": gold_key,
            "gold_filename": gold_filename,
            "rows": len(df),
        }
