"""
Metadata Catalog utilities for writing data asset metadata to FlowForge database.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from prefect import get_run_logger
import logging


def _logger():
    try:
        return get_run_logger()
    except Exception:
        return logging.getLogger("metadata_catalog")


def get_sqlite_db_path() -> Path:
    """Get the path to the FlowForge SQLite database."""
    import os

    # Try environment variable first
    env_db_path = os.getenv('FLOWFORGE_DB_PATH')
    if env_db_path:
        env_path = Path(env_db_path)
        if env_path.exists():
            return env_path
        logger = _logger()
        logger.warning(f"FLOWFORGE_DB_PATH={env_db_path} not found, falling back to repo default")

    # Hardcoded fallback for development
    # TODO: Make this configurable for production deployments
    hardcoded_path = Path(r"C:\Dev\FlowForge\apps\web\data\flowforge.db")
    if hardcoded_path.exists():
        return hardcoded_path

    # Last resort: try to compute from file location (won't work with Prefect's temp execution)
    this_file = Path(__file__).resolve()
    utils_dir = this_file.parent
    prefect_flows_dir = utils_dir.parent
    project_root = prefect_flows_dir.parent
    db_path = project_root / "apps" / "web" / "data" / "flowforge.db"

    return db_path


def get_database_connection() -> sqlite3.Connection:
    """Get a connection to the FlowForge SQLite database."""
    db_path = get_sqlite_db_path()

    if not db_path.exists():
        raise FileNotFoundError(f"FlowForge database not found at {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def normalize_environment(env: str) -> str:
    """
    Normalize environment values to match database constraint.

    UI sends: development, qa, uat, production
    DB expects: dev, qa, uat, prod
    """
    env_mapping = {
        'development': 'dev',
        'production': 'prod',
        'dev': 'dev',
        'qa': 'qa',
        'uat': 'uat',
        'prod': 'prod',
    }
    return env_mapping.get(env.lower(), 'dev')


def generate_asset_id(layer: str, workflow_slug: str, job_slug: str) -> str:
    """Generate a unique asset ID for the metadata catalog."""
    timestamp_ms = int(datetime.now().timestamp() * 1000)
    return f"asset_{layer}_{timestamp_ms}"


def get_file_size_from_s3(s3_key: str) -> int:
    """Get file size from S3/MinIO."""
    try:
        from utils.s3 import S3Client
        s3 = S3Client()
        response = s3.s3_client.head_object(Bucket=s3.bucket, Key=s3_key)
        return response.get('ContentLength', 0)
    except Exception as e:
        logger = _logger()
        logger.warning(f"Failed to get file size for {s3_key}: {e}")
        return 0


def get_schema_from_dataframe(df: Any) -> List[Dict[str, Any]]:
    """
    Extract schema with data types from a Polars DataFrame.

    Args:
        df: Polars DataFrame

    Returns:
        List of column definitions with name, type, and nullable fields
    """
    import polars as pl

    schema = []
    for col_name in df.columns:
        dtype = df.schema[col_name]

        # Convert Polars dtype to human-readable string
        dtype_str = str(dtype)

        # Simplify common types
        type_mapping = {
            'Int8': 'integer',
            'Int16': 'integer',
            'Int32': 'integer',
            'Int64': 'integer',
            'UInt8': 'integer',
            'UInt16': 'integer',
            'UInt32': 'integer',
            'UInt64': 'integer',
            'Float32': 'float',
            'Float64': 'float',
            'Utf8': 'string',
            'String': 'string',
            'Boolean': 'boolean',
            'Date': 'date',
            'Datetime': 'datetime',
            'Time': 'time',
        }

        # Get simplified type or use the Polars type string
        simplified_type = type_mapping.get(dtype_str, dtype_str.lower())

        schema.append({
            "name": col_name,
            "type": simplified_type,
            "nullable": True  # Default to nullable, could be refined with nullability analysis
        })

    return schema


def upsert_metadata_catalog_entry(
    layer: str,
    table_name: str,
    source_id: str,
    file_path: str,
    schema: List[Dict[str, Any]],
    row_count: int,
    file_size: int,
    parent_tables: Optional[List[str]] = None,
    environment: str = "prod",
    description: Optional[str] = None,
    tags: Optional[List[str]] = None,
    owner: Optional[str] = None,
) -> str:
    """
    Insert or update an entry in the metadata_catalog table.

    Args:
        layer: bronze, silver, or gold
        table_name: Human-readable table name
        source_id: Source ID that created this asset
        file_path: S3 path to the file
        schema: List of column definitions
        row_count: Number of rows in the dataset
        file_size: File size in bytes
        parent_tables: List of parent table names for lineage
        environment: Environment (dev, qa, uat, prod)
        description: Optional description
        tags: Optional tags
        owner: Optional owner

    Returns:
        The asset ID (created or updated)
    """
    logger = _logger()
    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        # Check if asset already exists for this layer + table_name + environment (matches UNIQUE constraint)
        cursor.execute(
            "SELECT id FROM metadata_catalog WHERE layer = ? AND table_name = ? AND environment = ?",
            (layer, table_name, environment)
        )
        existing = cursor.fetchone()

        now_ms = int(datetime.now().timestamp() * 1000)

        if existing:
            # Update existing entry
            asset_id = existing[0]
            logger.info(f"Updating existing {layer} catalog entry: {asset_id}")

            cursor.execute(
                """
                UPDATE metadata_catalog
                SET source_id = ?,
                    table_name = ?,
                    schema = ?,
                    row_count = ?,
                    file_size = ?,
                    file_path = ?,
                    parent_tables = ?,
                    description = ?,
                    tags = ?,
                    owner = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    source_id,
                    table_name,
                    json.dumps(schema),
                    row_count,
                    file_size,
                    file_path,
                    json.dumps(parent_tables) if parent_tables else None,
                    description,
                    json.dumps(tags) if tags else None,
                    owner,
                    now_ms,
                    asset_id,
                )
            )
        else:
            # Create new entry
            asset_id = generate_asset_id(layer, table_name, source_id)
            logger.info(f"Creating new {layer} catalog entry: {asset_id}")

            cursor.execute(
                """
                INSERT INTO metadata_catalog (
                    id, layer, table_name, source_id, environment,
                    schema, row_count, file_size, file_path,
                    parent_tables, description, tags, owner,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    asset_id,
                    layer,
                    table_name,
                    source_id,
                    environment,
                    json.dumps(schema),
                    row_count,
                    file_size,
                    file_path,
                    json.dumps(parent_tables) if parent_tables else None,
                    description,
                    json.dumps(tags) if tags else None,
                    owner,
                    now_ms,
                    now_ms,
                )
            )

        conn.commit()
        logger.info(f"✅ Metadata catalog entry saved: {asset_id} ({layer}/{table_name})")
        return asset_id

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Failed to write to metadata catalog: {e}")
        raise
    finally:
        conn.close()


def catalog_bronze_asset(
    source_id: str,
    workflow_slug: str,
    source_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    environment: str = "prod",
    custom_table_name: Optional[str] = None,
) -> str:
    """
    Convenience function to catalog a Bronze layer asset.

    Args:
        source_id: Source ID
        workflow_slug: Workflow slug
        source_slug: Source slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        environment: Environment
        custom_table_name: User-configured table name from UI (e.g., "loan_payments_bronze")

    Returns:
        Asset ID
    """
    # Use custom table name if provided, otherwise generate from source_slug
    table_name = custom_table_name if custom_table_name else f"{source_slug}_bronze"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="bronze",
        table_name=table_name,
        source_id=source_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=None,  # Bronze has no parents
        environment=normalize_environment(environment),
        description=f"Bronze layer for {source_slug}",
    )


def catalog_silver_asset(
    source_id: str,
    workflow_slug: str,
    source_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    parent_bronze_table: str,
    environment: str = "prod",
    custom_table_name: Optional[str] = None,
) -> str:
    """
    Convenience function to catalog a Silver layer asset.

    Args:
        source_id: Source ID
        workflow_slug: Workflow slug
        source_slug: Source slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        parent_bronze_table: Name of the parent Bronze table
        environment: Environment
        custom_table_name: User-configured table name from UI (e.g., "loan_payments_silver")

    Returns:
        Asset ID
    """
    # Use custom table name if provided, otherwise generate from source_slug
    table_name = custom_table_name if custom_table_name else f"{source_slug}_silver"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="silver",
        table_name=table_name,
        source_id=source_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=[parent_bronze_table],
        environment=normalize_environment(environment),
        description=f"Silver layer for {source_slug}",
    )


def catalog_gold_asset(
    source_id: str,
    workflow_slug: str,
    source_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    parent_silver_table: str,
    environment: str = "prod",
    custom_table_name: Optional[str] = None,
) -> str:
    """
    Convenience function to catalog a Gold layer asset.

    Args:
        source_id: Source ID
        workflow_slug: Workflow slug
        source_slug: Source slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        parent_silver_table: Name of the parent Silver table
        environment: Environment
        custom_table_name: User-configured table name from UI (e.g., "loan_payments_gold")

    Returns:
        Asset ID
    """
    # Use custom table name if provided, otherwise generate from source_slug
    table_name = custom_table_name if custom_table_name else f"{source_slug}_gold"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="gold",
        table_name=table_name,
        source_id=source_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=[parent_silver_table],
        environment=normalize_environment(environment),
        description=f"Gold layer for {source_slug}",
    )


# =============================================================================
# LAYER-CENTRIC MODE (Dataset Jobs) FUNCTIONS
# =============================================================================

# Valid dataset status values (matches TypeScript DatasetStatus type)
DATASET_STATUS_PENDING = "pending"
DATASET_STATUS_RUNNING = "running"
DATASET_STATUS_READY = "ready"
DATASET_STATUS_FAILED = "failed"

VALID_DATASET_STATUSES = [
    DATASET_STATUS_PENDING,
    DATASET_STATUS_RUNNING,
    DATASET_STATUS_READY,
    DATASET_STATUS_FAILED,
]


def update_dataset_status(
    table_name: str,
    status: str,
    environment: str = "prod",
    execution_id: Optional[str] = None,
) -> bool:
    """
    Update the dataset_status field in the metadata_catalog.

    Used by layer-centric Dataset Jobs to track readiness for downstream jobs.

    Args:
        table_name: Name of the table in the catalog
        status: New status (pending, running, ready, failed)
        environment: Environment (dev, qa, uat, prod)
        execution_id: Optional execution ID to track which run updated this

    Returns:
        True if update was successful, False if table not found
    """
    logger = _logger()

    if status not in VALID_DATASET_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Must be one of: {VALID_DATASET_STATUSES}")

    env = normalize_environment(environment)
    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        # Check if entry exists
        cursor.execute(
            "SELECT id FROM metadata_catalog WHERE table_name = ? AND environment = ?",
            (table_name, env)
        )
        existing = cursor.fetchone()

        if not existing:
            logger.warning(f"Dataset '{table_name}' not found in catalog for environment '{env}'")
            return False

        # Update status
        now_ms = int(datetime.now().timestamp() * 1000)
        if execution_id:
            cursor.execute(
                """
                UPDATE metadata_catalog
                SET dataset_status = ?, last_execution_id = ?, updated_at = ?
                WHERE table_name = ? AND environment = ?
                """,
                (status, execution_id, now_ms, table_name, env)
            )
        else:
            cursor.execute(
                """
                UPDATE metadata_catalog
                SET dataset_status = ?, updated_at = ?
                WHERE table_name = ? AND environment = ?
                """,
                (status, now_ms, table_name, env)
            )

        conn.commit()
        logger.info(f"✅ Dataset status updated: {table_name} -> {status}")
        return True

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Failed to update dataset status: {e}")
        raise
    finally:
        conn.close()


def get_dataset_paths(
    table_names: List[str],
    environment: str = "prod",
) -> Dict[str, Dict[str, Any]]:
    """
    Resolve multiple table names to their S3 paths and metadata.

    Used by layer-centric Dataset Jobs to resolve input datasets.

    Args:
        table_names: List of table names to resolve
        environment: Environment (dev, qa, uat, prod)

    Returns:
        Dict mapping table_name -> {path, schema, row_count, status, layer}
    """
    logger = _logger()
    env = normalize_environment(environment)
    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        placeholders = ", ".join(["?" for _ in table_names])
        cursor.execute(
            f"""
            SELECT table_name, layer, file_path, schema, row_count, file_size, dataset_status
            FROM metadata_catalog
            WHERE table_name IN ({placeholders}) AND environment = ?
            """,
            (*table_names, env)
        )
        rows = cursor.fetchall()

        result = {}
        for row in rows:
            result[row["table_name"]] = {
                "layer": row["layer"],
                "path": row["file_path"],
                "schema": json.loads(row["schema"]) if row["schema"] else [],
                "row_count": row["row_count"] or 0,
                "file_size": row["file_size"] or 0,
                "status": row["dataset_status"] or DATASET_STATUS_READY,
                "is_ready": (row["dataset_status"] or DATASET_STATUS_READY) == DATASET_STATUS_READY,
            }

        # Log warnings for not-found tables
        found_tables = set(result.keys())
        for table_name in table_names:
            if table_name not in found_tables:
                logger.warning(f"Dataset '{table_name}' not found in catalog")

        return result

    except Exception as e:
        logger.error(f"❌ Failed to get dataset paths: {e}")
        raise
    finally:
        conn.close()


def check_datasets_ready(
    table_names: List[str],
    environment: str = "prod",
) -> Dict[str, Any]:
    """
    Check if all specified datasets are ready.

    Used by layer-centric Dataset Jobs before execution to ensure inputs are available.

    Args:
        table_names: List of table names to check
        environment: Environment (dev, qa, uat, prod)

    Returns:
        Dict with:
            - all_ready: bool
            - ready: List of ready table names
            - not_ready: List of {name, status} for tables not ready
            - not_found: List of table names not in catalog
    """
    datasets = get_dataset_paths(table_names, environment)

    ready = []
    not_ready = []
    not_found = []

    for table_name in table_names:
        if table_name not in datasets:
            not_found.append(table_name)
        elif datasets[table_name]["is_ready"]:
            ready.append(table_name)
        else:
            not_ready.append({
                "name": table_name,
                "status": datasets[table_name]["status"]
            })

    return {
        "all_ready": len(not_ready) == 0 and len(not_found) == 0,
        "ready": ready,
        "not_ready": not_ready,
        "not_found": not_found,
    }


def catalog_dataset_job_output(
    output_table_name: str,
    layer: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    parent_tables: List[str],
    source_id: Optional[str] = None,
    environment: str = "prod",
    description: Optional[str] = None,
    execution_id: Optional[str] = None,
) -> str:
    """
    Catalog the output of a layer-centric Dataset Job.

    Similar to catalog_bronze/silver/gold_asset but designed for Dataset Jobs
    which may have multiple parent tables.

    Args:
        output_table_name: Name for the output table
        layer: Target layer (bronze, silver, gold)
        s3_key: S3 key for the output file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        parent_tables: List of parent table names (for lineage)
        source_id: Optional source ID (may be None for standalone Dataset Jobs)
        environment: Environment
        description: Optional description
        execution_id: Optional execution ID

    Returns:
        Asset ID
    """
    logger = _logger()
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)
    env = normalize_environment(environment)

    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        # Check if entry exists
        cursor.execute(
            "SELECT id FROM metadata_catalog WHERE layer = ? AND table_name = ? AND environment = ?",
            (layer, output_table_name, env)
        )
        existing = cursor.fetchone()

        now_ms = int(datetime.now().timestamp() * 1000)

        if existing:
            asset_id = existing[0]
            logger.info(f"Updating existing {layer} catalog entry: {asset_id}")

            cursor.execute(
                """
                UPDATE metadata_catalog
                SET source_id = ?,
                    schema = ?,
                    row_count = ?,
                    file_size = ?,
                    file_path = ?,
                    parent_tables = ?,
                    description = ?,
                    dataset_status = ?,
                    last_execution_id = ?,
                    updated_at = ?
                WHERE id = ?
                """,
                (
                    source_id,
                    json.dumps(schema),
                    row_count,
                    file_size,
                    f"s3://flowforge-data/{s3_key}",
                    json.dumps(parent_tables) if parent_tables else None,
                    description or f"Dataset Job output: {output_table_name}",
                    DATASET_STATUS_READY,  # Mark as ready after successful write
                    execution_id,
                    now_ms,
                    asset_id,
                )
            )
        else:
            asset_id = generate_asset_id(layer, output_table_name, source_id or "dataset_job")
            logger.info(f"Creating new {layer} catalog entry: {asset_id}")

            cursor.execute(
                """
                INSERT INTO metadata_catalog (
                    id, layer, table_name, source_id, environment,
                    schema, row_count, file_size, file_path,
                    parent_tables, description, dataset_status, last_execution_id,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    asset_id,
                    layer,
                    output_table_name,
                    source_id,
                    env,
                    json.dumps(schema),
                    row_count,
                    file_size,
                    f"s3://flowforge-data/{s3_key}",
                    json.dumps(parent_tables) if parent_tables else None,
                    description or f"Dataset Job output: {output_table_name}",
                    DATASET_STATUS_READY,
                    execution_id,
                    now_ms,
                    now_ms,
                )
            )

        conn.commit()
        logger.info(f"✅ Dataset Job output cataloged: {asset_id} ({layer}/{output_table_name})")
        return asset_id

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Failed to catalog Dataset Job output: {e}")
        raise
    finally:
        conn.close()


# =============================================================================
# ORIGINAL SOURCE-CENTRIC FUNCTIONS
# =============================================================================


def update_job_execution_metrics(
    job_id: str,
    bronze_records: Optional[int] = None,
    silver_records: Optional[int] = None,
    gold_records: Optional[int] = None,
    quarantined_records: Optional[int] = None,
) -> None:
    """
    Update record counts for a source execution in the database.

    This function finds the most recent source_execution for the given source_id (job_id)
    and updates the bronze_records, silver_records, gold_records, and/or quarantined_records columns.

    Args:
        job_id: Source ID (job_id parameter name kept for backward compatibility)
        bronze_records: Number of bronze records (optional)
        silver_records: Number of silver records (optional)
        gold_records: Number of gold records (optional)
        quarantined_records: Number of quarantined records (optional)
    """
    logger = _logger()
    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        # Find the most recent source_execution for this source_id
        cursor.execute(
            """
            SELECT id FROM source_executions
            WHERE source_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (job_id,)
        )
        result = cursor.fetchone()

        if not result:
            logger.warning(f"No source_execution found for source_id={job_id}")
            return

        source_execution_id = result[0]

        # Build UPDATE query dynamically based on which metrics are provided
        updates = []
        params = []

        if bronze_records is not None:
            updates.append("bronze_records = ?")
            params.append(bronze_records)

        if silver_records is not None:
            updates.append("silver_records = ?")
            params.append(silver_records)

        if gold_records is not None:
            updates.append("gold_records = ?")
            params.append(gold_records)

        if quarantined_records is not None:
            updates.append("quarantined_records = ?")
            params.append(quarantined_records)

        if not updates:
            logger.warning("No metrics provided to update")
            return

        # Add updated_at timestamp
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())

        # Add source_execution_id to params
        params.append(source_execution_id)

        # Execute UPDATE
        query = f"UPDATE source_executions SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

        logger.info(f"✅ Updated source_execution metrics for source_id={job_id}: bronze={bronze_records}, silver={silver_records}, gold={gold_records}")

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Failed to update source_execution metrics: {e}")
        raise
    finally:
        conn.close()
