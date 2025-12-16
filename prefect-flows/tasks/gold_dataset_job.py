"""
Gold Dataset Job Task

Layer-centric Prefect task that aggregates/transforms multiple Silver inputs into a Gold output.
Uses SQL transformation with DuckDB for cross-source aggregations.
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile
import uuid

import polars as pl
import duckdb
from prefect import task, get_run_logger

from utils.s3 import S3Client
from utils.metadata_catalog import (
    get_dataset_paths,
    check_datasets_ready,
    update_dataset_status,
    catalog_dataset_job_output,
    DATASET_STATUS_RUNNING,
    DATASET_STATUS_READY,
    DATASET_STATUS_FAILED,
)
from utils.parquet_utils import write_parquet


def _register_table(con: duckdb.DuckDBPyConnection, local_file: Path, table_name: str) -> int:
    """
    Register a local file as a DuckDB table, handling CSV/JSON/Parquet.

    Returns:
        Row count.
    """
    suffix = local_file.suffix.lower()
    if suffix == ".csv":
        con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_csv_auto('{local_file}', header=True)")
    elif suffix == ".json":
        con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_json_auto('{local_file}')")
    else:
        con.execute(f"CREATE TABLE {table_name} AS SELECT * FROM read_parquet('{local_file}')")

    return con.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()[0]


def _build_gold_dataset_key(
    output_table_name: str,
    run_id: str,
    build_strategy: str = "versioned",
) -> tuple[str, str]:
    """
    Build S3 keys for Gold dataset job output.

    Args:
        output_table_name: Name of the output table
        run_id: Unique run identifier
        build_strategy: 'versioned' or 'full_rebuild'

    Returns:
        (current_key, archive_key)
    """
    date_folder = datetime.utcnow().strftime("%Y%m%d")
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if build_strategy == "full_rebuild":
        # Fixed filename for full rebuild - overwrites each time
        current_filename = f"{output_table_name}_current.parquet"
    else:
        # Versioned filename (default)
        current_filename = f"{output_table_name}_{run_id}.parquet"

    current_key = f"gold/{output_table_name}/{date_folder}/{current_filename}"

    archive_filename = f"{timestamp}_v001.parquet"
    archive_key = f"gold/{output_table_name}/{date_folder}/archive/{archive_filename}"

    return current_key, archive_key


def _extract_s3_key_from_path(file_path: str) -> str:
    """
    Extract S3 key from a full S3 path.

    Args:
        file_path: Full path like 's3://flowforge-data/silver/...'

    Returns:
        Just the key portion: 'silver/...'
    """
    if file_path.startswith("s3://"):
        parts = file_path.split("/", 3)
        if len(parts) >= 4:
            return parts[3]
    return file_path


@task(name="gold_dataset_job", retries=1, retry_delay_seconds=30)
def gold_dataset_job(
    input_datasets: list[str],
    transform_sql: str,
    output_table_name: str,
    *,
    source_id: str | None = None,
    execution_id: str | None = None,
    environment: str = "prod",
    gold_config: dict | None = None,
) -> dict:
    """
    Execute a Gold layer Dataset Job that aggregates/transforms multiple Silver inputs.

    This is a layer-centric task that:
    1. Downloads multiple Silver datasets from S3
    2. Loads them into DuckDB as named tables
    3. Executes the SQL transform (typically aggregations)
    4. Writes output to Gold layer
    5. Catalogs with multiple parent_tables for lineage

    Args:
        input_datasets: List of Silver table names to use as inputs
        transform_sql: SQL query to transform/aggregate the inputs
        output_table_name: Name for the output Gold table
        source_id: Optional source ID (for tracking)
        execution_id: Optional execution ID
        environment: Environment (dev, qa, uat, prod)
        gold_config: Optional Gold layer configuration

    Returns:
        Dict with output metadata including gold_key, records, columns
    """
    logger = get_run_logger()
    s3 = S3Client()
    run_id = str(uuid.uuid4())[:8]

    gold_config = gold_config or {}
    build_strategy = gold_config.get("buildStrategy", "versioned")

    logger.info("=" * 60)
    logger.info("🥇 GOLD DATASET JOB")
    logger.info("=" * 60)
    logger.info(f"Output table: {output_table_name}")
    logger.info(f"Input datasets: {input_datasets}")
    logger.info(f"Build strategy: {build_strategy}")
    logger.info(f"Environment: {environment}")
    logger.info(f"Run ID: {run_id}")

    # Mark output as running (if it exists in catalog already)
    update_dataset_status(output_table_name, DATASET_STATUS_RUNNING, environment, execution_id)

    try:
        # Step 1: Check if all input datasets are ready
        logger.info("\n📋 Step 1: Checking input dataset readiness...")
        readiness = check_datasets_ready(input_datasets, environment)

        if not readiness["all_ready"]:
            if readiness["not_found"]:
                raise ValueError(f"Input datasets not found in catalog: {readiness['not_found']}")
            if readiness["not_ready"]:
                not_ready_info = ", ".join([f"{d['name']}({d['status']})" for d in readiness["not_ready"]])
                raise ValueError(f"Input datasets not ready: {not_ready_info}")

        logger.info(f"   ✅ All {len(input_datasets)} input datasets are ready")

        # Step 2: Resolve dataset paths
        logger.info("\n📋 Step 2: Resolving dataset paths...")
        dataset_info = get_dataset_paths(input_datasets, environment)

        for table_name, info in dataset_info.items():
            logger.info(f"   - {table_name}: {info['row_count']} rows, {info['layer']} layer")

        # Step 3: Download and load into DuckDB
        logger.info("\n📋 Step 3: Downloading datasets and loading into DuckDB...")

        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
            tmp_path = Path(tmp_dir)

            # Use in-memory DuckDB to avoid file locking issues on Windows
            con = duckdb.connect(":memory:")

            try:
                # Download each dataset and register as a table
                for table_name in input_datasets:
                    info = dataset_info[table_name]
                    s3_key = _extract_s3_key_from_path(info["path"])

                    file_ext = Path(s3_key).suffix or ".parquet"
                    local_file = tmp_path / f"{table_name}{file_ext}"
                    logger.info(f"   Downloading {table_name} from {s3_key}...")
                    s3.download_file(s3_key, local_file)

                    # Register as a DuckDB table
                    row_count = _register_table(con, local_file, table_name)
                    logger.info(f"   ✅ Registered {table_name}: {row_count} rows")

                # Step 4: Execute SQL transform
                logger.info("\n📋 Step 4: Executing SQL transform...")
                logger.info(f"   SQL:\n{transform_sql[:500]}{'...' if len(transform_sql) > 500 else ''}")

                result_df = con.execute(transform_sql).pl()
                logger.info(f"   ✅ Transform complete: {result_df.height} rows, {len(result_df.columns)} columns")

            finally:
                # Ensure DuckDB connection is closed
                con.close()

            # Step 5: Write to Gold layer
            logger.info("\n📋 Step 5: Writing to Gold layer...")
            current_key, archive_key = _build_gold_dataset_key(output_table_name, run_id, build_strategy)

            local_output = tmp_path / "output.parquet"
            write_parquet(result_df, local_output)

            # Archive previous if exists
            if s3.object_exists(current_key):
                logger.info(f"   Archiving previous version to {archive_key}")
                previous_path = tmp_path / "previous.parquet"
                s3.download_file(current_key, previous_path)
                s3.upload_file(previous_path, archive_key)

            s3.upload_file(local_output, current_key)
            logger.info(f"   ✅ Uploaded to {current_key}")

            # Step 6: Optionally load into DuckDB analytics database
            duckdb_enabled = False
            gold_table_name = None
            try:
                # Check if Gold analytics DuckDB is available
                from utils.duckdb_gold import load_to_gold_duckdb
                gold_table_name = load_to_gold_duckdb(
                    result_df,
                    output_table_name,
                    logger
                )
                duckdb_enabled = True
                logger.info(f"   ✅ Loaded into Gold DuckDB as: {gold_table_name}")
            except ImportError:
                logger.info("   ℹ️ Gold DuckDB module not available, skipping")
            except Exception as e:
                logger.warning(f"   ⚠️ Failed to load into Gold DuckDB: {e}")

            # Step 7: Catalog the output
            logger.info("\n📋 Step 6: Cataloging output...")
            asset_id = catalog_dataset_job_output(
                output_table_name=output_table_name,
                layer="gold",
                s3_key=current_key,
                row_count=result_df.height,
                dataframe=result_df,
                parent_tables=input_datasets,  # All inputs become parents
                source_id=source_id,
                environment=environment,
                description=f"Gold Dataset Job: {output_table_name} (from {', '.join(input_datasets)})",
                execution_id=execution_id,
            )
            logger.info(f"   ✅ Cataloged: {asset_id}")

        # Success!
        logger.info("\n" + "=" * 60)
        logger.info("✅ GOLD DATASET JOB COMPLETE")
        logger.info("=" * 60)
        logger.info(f"   Output: {output_table_name}")
        logger.info(f"   Records: {result_df.height}")
        logger.info(f"   Columns: {result_df.columns}")
        logger.info(f"   Parents: {input_datasets}")
        logger.info(f"   DuckDB: {'enabled' if duckdb_enabled else 'disabled'}")

        return {
            "status": "success",
            "output_table_name": output_table_name,
            "gold_key": current_key,
            "gold_table_name": gold_table_name,
            "duckdb_enabled": duckdb_enabled,
            "records": result_df.height,
            "columns": result_df.columns,
            "input_datasets": input_datasets,
            "parent_tables": input_datasets,
            "environment": environment,
            "run_id": run_id,
            "asset_id": asset_id,
        }

    except Exception as e:
        logger.error(f"\n❌ GOLD DATASET JOB FAILED: {e}")
        import traceback
        logger.error(traceback.format_exc())

        # Mark output as failed
        update_dataset_status(output_table_name, DATASET_STATUS_FAILED, environment, execution_id)

        raise
