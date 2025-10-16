from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.parquet_utils import add_audit_columns, read_csv, write_parquet
from utils.s3 import S3Client
from utils.slugify import slugify, generate_run_id
from utils.metadata_catalog import catalog_bronze_asset, update_job_execution_metrics
from utils.file_handlers import get_file_handler, detect_file_format


def _build_bronze_key(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    source_filename: str,
    sequence: int = 1
) -> tuple[str, str]:
    """
    Return (filename, s3_key) for the bronze layer object.

    Pattern: bronze/{workflowSlug}/{jobSlug}/{yyyymmdd}/{workflowSlug}_{jobSlug}_{runId}_v{sequence}.parquet

    Human-friendly naming:
    - Single underscores instead of double
    - No redundant "__bronze" suffix (layer is in path)
    - Clean version numbering: v001, v002, etc.
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    source_stem = Path(source_filename).stem

    filename = f"{workflow_slug}_{job_slug}_{run_id}_v{sequence:03d}.parquet"
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
    file_format: str = "csv",
    file_options: dict | None = None,
    column_mappings: list[dict] | None = None,
    has_header: bool = True,
    infer_schema_length: int | None = None,
) -> dict:
    """Convert a landing file into a Bronze Parquet dataset.

    Supports CSV, JSON, Parquet, and Excel files via pluggable handler framework.

    Args:
        workflow_id: External workflow identifier (for legacy compatibility).
        job_id: Job identifier (for legacy compatibility).
        workflow_slug: Human-readable workflow slug (e.g., "customer-data-pipeline").
        job_slug: Human-readable job slug (e.g., "ingest-countries").
        run_id: Short run identifier (e.g., "cfee487b" or "20251006-abc123").
        landing_key: S3 key under `landing/` that points to the file.
        file_format: File format ('csv', 'json', 'parquet', 'excel'). Auto-detected if not specified.
        file_options: Format-specific options (e.g., delimiter, encoding for CSV)
        column_mappings: Optional list of column mappings for headerless CSVs
            [{"sourceColumn": "Column_0", "targetColumn": "customer_id", "dataType": "integer"}, ...]
        has_header: Whether the CSV file has a header row (default: True) - CSV only
        infer_schema_length: Optional inference window for CSV schema - CSV only

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
        local_file = tmp_dir_path / Path(landing_key).name
        s3.download_file(landing_key, local_file)

        # Auto-detect file format if not specified
        if not file_format or file_format == "csv":
            detected_format = detect_file_format(str(local_file))
            if file_format != detected_format:
                logger.info(f"Auto-detected file format: {detected_format} (specified: {file_format})")
                file_format = detected_format

        # Get appropriate file handler
        try:
            handler = get_file_handler(str(local_file))
            logger.info(f"Using {handler.__class__.__name__} for file format: {file_format}")
        except ValueError as e:
            logger.error(f"No handler found for file: {local_file}")
            raise

        # Prepare file options based on format
        if file_options is None:
            file_options = {}

        # For CSV, add legacy parameters to options
        if file_format == "csv":
            file_options.setdefault("has_header", has_header)
            file_options.setdefault("infer_schema_length", infer_schema_length)

        # Read file using appropriate handler
        logger.info(f"Reading {file_format.upper()} file with options: {file_options}")
        df = handler.read(str(local_file), file_options)
        logger.info(f"Successfully read file: {df.height} rows, {df.width} columns")

        # Apply column mappings if provided (for headerless CSVs with AI-generated names)
        if column_mappings and len(column_mappings) > 0:
            logger.info(f"Applying {len(column_mappings)} column mappings from AI suggestions")
            rename_map = {mapping["sourceColumn"]: mapping["targetColumn"] for mapping in column_mappings}
            logger.info(f"Column rename map: {rename_map}")
            df = df.rename(rename_map)
            logger.info(f"Renamed columns: {df.columns}")

        df = add_audit_columns(df, source_file=Path(landing_key).name)

        # Persist to Parquet locally and upload to MinIO
        local_parquet = tmp_dir_path / bronze_filename
        write_parquet(df, local_parquet)
        s3.upload_file(local_parquet, bronze_key)

    logger.info("Bronze dataset created: s3://%s/%s", s3.bucket, bronze_key)

    # Write metadata to catalog
    try:
        asset_id = catalog_bronze_asset(
            job_id=job_id,
            workflow_slug=workflow_slug,
            job_slug=job_slug,
            s3_key=bronze_key,
            row_count=df.height,
            dataframe=df,
            environment="prod",
        )
        logger.info(f"✅ Bronze metadata cataloged: {asset_id}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to catalog bronze metadata: {e}")

    # Update job execution metrics
    try:
        update_job_execution_metrics(
            job_id=job_id,
            bronze_records=df.height,
        )
        logger.info(f"✅ Updated job execution metrics: bronze_records={df.height}")
    except Exception as e:
        logger.warning(f"⚠️ Failed to update job execution metrics: {e}")

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
