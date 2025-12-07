from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.duckdb_helper import (
    get_connection,
    create_table_from_dataframe,
    export_to_parquet,
    get_table_stats,
    list_tables,
)
from utils.parquet_utils import read_parquet, write_parquet
from utils.s3 import S3Client
from utils.metadata_catalog import catalog_gold_asset, update_job_execution_metrics


def _build_gold_key(
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    domain: str = "analytics",
) -> tuple[str, str]:
    """
    Return (filename, s3_key) for the gold layer.

    Pattern: gold/{domain}/{dataset}/{yyyymmdd}/{dataset}_{runId}.parquet

    Human-friendly naming:
    - Single underscores instead of double
    - No redundant "__gold" or "__view" suffix (gold layer implies analytics-ready view)
    - Dataset name from job_slug provides business context
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    dataset = job_slug  # e.g., "ingest-customers" becomes the dataset name

    filename = f"{dataset}_{run_id}.parquet"
    s3_key = f"gold/{domain}/{dataset}/{date_folder}/{filename}"

    return filename, s3_key


def _get_gold_table_name(workflow_slug: str, job_slug: str) -> str:
    """Generate a DuckDB table name for the Gold layer."""
    # Create a clean table name like "gold_customer_data_ingest_customers"
    clean_workflow = workflow_slug.replace("-", "_").lower()
    clean_job = job_slug.replace("-", "_").lower()
    return f"gold_{clean_workflow}_{clean_job}"


@task(name="gold_publish")
def gold_publish(silver_result: dict, domain: str = "analytics") -> dict:
    """
    Publish analytics outputs to the Gold layer with DuckDB.

    This task:
    1. Loads Silver Parquet data into DuckDB
    2. Creates an analytics-ready table in DuckDB
    3. Exports the table to Parquet for distribution
    4. Uploads to S3/MinIO Gold layer

    Args:
        silver_result: Output from silver_transform task
        domain: Analytics domain (default: "analytics")

    Returns:
        Dictionary with Gold layer artifact information
    """
    logger = get_run_logger()
    s3 = S3Client()

    workflow_id = silver_result["workflow_id"]
    job_id = silver_result["job_id"]
    workflow_slug = silver_result["workflow_slug"]
    job_slug = silver_result["job_slug"]
    run_id = silver_result["run_id"]
    silver_key = silver_result["silver_key"]

    logger.info(f"🏆 Starting Gold layer publish from Silver: {silver_key}")

    gold_filename, gold_key = _build_gold_key(workflow_slug, job_slug, run_id, domain)
    gold_table_name = _get_gold_table_name(workflow_slug, job_slug)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        silver_file = tmp_path / "silver.parquet"
        gold_file = tmp_path / gold_filename

        # Download Silver file
        logger.info(f"📥 Downloading Silver data: {silver_key}")
        s3.download_file(silver_key, str(silver_file))

        # Read Silver data
        df = read_parquet(str(silver_file))
        logger.info(f"📊 Silver data loaded: {len(df)} rows, {len(df.columns)} columns")

        # Connect to DuckDB and load data
        duckdb_used = False
        try:
            logger.info(f"🦆 Connecting to DuckDB analytics database...")
            conn = get_connection()

            # Create/replace table in DuckDB with Silver data
            logger.info(f"📝 Creating DuckDB table: {gold_table_name}")
            rows_loaded = create_table_from_dataframe(conn, gold_table_name, df, replace=True)
            logger.info(f"✅ Loaded {rows_loaded} rows into DuckDB table '{gold_table_name}'")

            # Get table stats for logging
            stats = get_table_stats(conn, gold_table_name)
            logger.info(f"📈 DuckDB table stats: {stats.get('row_count', 0)} rows, {stats.get('column_count', 0)} columns")

            # Export from DuckDB to Parquet with ZSTD compression
            logger.info(f"📤 Exporting from DuckDB to Parquet: {gold_file}")
            export_to_parquet(conn, gold_table_name, gold_file)

            # List all tables in DuckDB for visibility
            all_tables = list_tables(conn)
            logger.info(f"🗄️ DuckDB tables in analytics database: {all_tables}")

            conn.close()
            duckdb_used = True
            logger.info(f"✅ DuckDB Gold layer processing complete")

        except Exception as e:
            logger.warning(f"⚠️ DuckDB processing failed, falling back to direct Parquet: {e}")
            # Fallback: just write Parquet directly without DuckDB
            write_parquet(df, str(gold_file))

        # Upload to Gold layer in S3/MinIO
        logger.info(f"☁️ Uploading to Gold layer: {gold_key}")
        s3.upload_file(str(gold_file), gold_key)

        logger.info(f"✅ Gold layer published: {gold_key} ({len(df)} rows)")
        if duckdb_used:
            logger.info(f"🦆 Data also available in DuckDB table: {gold_table_name}")

        # Write metadata to catalog
        try:
            parent_silver_table = f"{workflow_slug}_{job_slug}_silver"
            asset_id = catalog_gold_asset(
                job_id=job_id,
                workflow_slug=workflow_slug,
                job_slug=job_slug,
                s3_key=gold_key,
                row_count=len(df),
                dataframe=df,
                parent_silver_table=parent_silver_table,
                environment="prod",
            )
            logger.info(f"✅ Gold metadata cataloged: {asset_id}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to catalog gold metadata: {e}")

        # Update job execution metrics
        try:
            update_job_execution_metrics(
                job_id=job_id,
                gold_records=len(df),
            )
            logger.info(f"✅ Updated job execution metrics: gold_records={len(df)}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to update job execution metrics: {e}")

        return {
            "workflow_id": workflow_id,
            "job_id": job_id,
            "workflow_slug": workflow_slug,
            "job_slug": job_slug,
            "run_id": run_id,
            "gold_key": gold_key,
            "gold_filename": gold_filename,
            "gold_table_name": gold_table_name,
            "duckdb_enabled": duckdb_used,
            "rows": len(df),
        }
