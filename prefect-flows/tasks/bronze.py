from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.parquet_utils import add_audit_columns, read_csv, write_parquet
from utils.s3 import S3Client
from utils.slugify import slugify, generate_run_id


def _build_bronze_key(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    source_filename: str,
    sequence: int = 1
) -> tuple[str, str]:
    """
    Return (filename, s3_key) for the bronze layer object.

    Pattern: bronze/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}__{jobSlug}__{runId}__bronze__v{sequence}.parquet
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    source_stem = Path(source_filename).stem

    filename = f"{workflow_slug}__{job_slug}__{run_id}__bronze__v{sequence:03d}.parquet"
    s3_key = f"bronze/{workflow_slug}/{job_slug}/{date_folder}/{filename}"

    return filename, s3_key


@task(name="bronze_ingest")
def bronze_ingest(
    *,
    workflow_id: str,
    job_id: str,
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    landing_key: str,
    infer_schema_length: int | None = None,
) -> dict:
    """Convert a landing CSV file into a Bronze Parquet dataset.

    Args:
        workflow_id: External workflow identifier (for legacy compatibility).
        job_id: Job identifier (for legacy compatibility).
        workflow_slug: Human-readable workflow slug (e.g., "customer-data-pipeline").
        job_slug: Human-readable job slug (e.g., "ingest-countries").
        run_id: Short run identifier (e.g., "cfee487b" or "20251006-abc123").
        landing_key: S3 key under `landing/` that points to the CSV file.
        infer_schema_length: Optional inference window for CSV schema.

    Returns:
        Dictionary describing the created Bronze artifact.
    """
    logger = get_run_logger()
    s3 = S3Client()

    source_filename = Path(landing_key).name
    bronze_filename, bronze_key = _build_bronze_key(
        workflow_slug, job_slug, run_id, source_filename, sequence=1
    )
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
        "workflow_slug": workflow_slug,
        "job_slug": job_slug,
        "run_id": run_id,
        "bronze_key": bronze_key,
        "bronze_filename": bronze_filename,
        "records": df.height,
        "columns": df.columns,
        "landing_key": landing_key,
    }
