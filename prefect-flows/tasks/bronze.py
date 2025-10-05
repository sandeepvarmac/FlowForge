from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.parquet_utils import add_audit_columns, read_csv, write_parquet
from utils.s3 import S3Client


def _build_bronze_key(workflow_id: str, job_id: str, source_key: str) -> tuple[str, str]:
    """Return (filename, s3_key) for the bronze layer object."""
    source_stem = Path(source_key).stem
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"{source_stem}_{timestamp}.parquet"
    s3_key = f"bronze/{workflow_id}/{job_id}/{filename}"
    return filename, s3_key


@task(name="bronze_ingest")
def bronze_ingest(
    *,
    workflow_id: str,
    job_id: str,
    landing_key: str,
    infer_schema_length: int | None = None,
) -> dict:
    """Convert a landing CSV file into a Bronze Parquet dataset.

    Args:
        workflow_id: External workflow identifier (used in S3 paths).
        job_id: Job identifier (used in S3 paths).
        landing_key: S3 key under `landing/` that points to the CSV file.
        infer_schema_length: Optional inference window for CSV schema.

    Returns:
        Dictionary describing the created Bronze artifact.
    """
    logger = get_run_logger()
    s3 = S3Client()

    bronze_filename, bronze_key = _build_bronze_key(workflow_id, job_id, landing_key)
    logger.info("Starting Bronze ingest for %s", landing_key)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_dir_path = Path(tmp_dir)
        local_csv = tmp_dir_path / Path(landing_key).name
        s3.download_file(landing_key, local_csv)

        df = read_csv(local_csv, infer_schema_length=infer_schema_length)
        df = add_audit_columns(df, source_file=Path(landing_key).name)

        # Persist to Parquet locally and upload to MinIO
        local_parquet = tmp_dir_path / bronze_filename
        write_parquet(df, local_parquet)
        s3.upload_file(local_parquet, bronze_key)

    logger.info("Bronze dataset created: s3://%s/%s", s3.bucket, bronze_key)

    return {
        "workflow_id": workflow_id,
        "job_id": job_id,
        "bronze_key": bronze_key,
        "records": df.height,
        "columns": df.columns,
        "landing_key": landing_key,
    }
