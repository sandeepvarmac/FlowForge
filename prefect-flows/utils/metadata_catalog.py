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
    job_id: str,
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
        job_id: Job ID that created this asset
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
                SET job_id = ?,
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
                    job_id,
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
            asset_id = generate_asset_id(layer, table_name, job_id)
            logger.info(f"Creating new {layer} catalog entry: {asset_id}")

            cursor.execute(
                """
                INSERT INTO metadata_catalog (
                    id, layer, table_name, job_id, environment,
                    schema, row_count, file_size, file_path,
                    parent_tables, description, tags, owner,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    asset_id,
                    layer,
                    table_name,
                    job_id,
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
    job_id: str,
    workflow_slug: str,
    job_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    environment: str = "prod",
) -> str:
    """
    Convenience function to catalog a Bronze layer asset.

    Args:
        job_id: Job ID
        workflow_slug: Workflow slug
        job_slug: Job slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        environment: Environment

    Returns:
        Asset ID
    """
    table_name = f"{workflow_slug}_{job_slug}_bronze"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="bronze",
        table_name=table_name,
        job_id=job_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=None,  # Bronze has no parents
        environment=environment,
        description=f"Bronze layer for {job_slug}",
    )


def catalog_silver_asset(
    job_id: str,
    workflow_slug: str,
    job_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    parent_bronze_table: str,
    environment: str = "prod",
) -> str:
    """
    Convenience function to catalog a Silver layer asset.

    Args:
        job_id: Job ID
        workflow_slug: Workflow slug
        job_slug: Job slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        parent_bronze_table: Name of the parent Bronze table
        environment: Environment

    Returns:
        Asset ID
    """
    table_name = f"{workflow_slug}_{job_slug}_silver"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="silver",
        table_name=table_name,
        job_id=job_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=[parent_bronze_table],
        environment=environment,
        description=f"Silver layer for {job_slug}",
    )


def catalog_gold_asset(
    job_id: str,
    workflow_slug: str,
    job_slug: str,
    s3_key: str,
    row_count: int,
    dataframe: Any,
    parent_silver_table: str,
    environment: str = "prod",
) -> str:
    """
    Convenience function to catalog a Gold layer asset.

    Args:
        job_id: Job ID
        workflow_slug: Workflow slug
        job_slug: Job slug
        s3_key: S3 key for the file
        row_count: Number of rows
        dataframe: Polars DataFrame to extract schema from
        parent_silver_table: Name of the parent Silver table
        environment: Environment

    Returns:
        Asset ID
    """
    table_name = f"{workflow_slug}_{job_slug}_gold"
    schema = get_schema_from_dataframe(dataframe)
    file_size = get_file_size_from_s3(s3_key)

    return upsert_metadata_catalog_entry(
        layer="gold",
        table_name=table_name,
        job_id=job_id,
        file_path=f"s3://flowforge-data/{s3_key}",
        schema=schema,
        row_count=row_count,
        file_size=file_size,
        parent_tables=[parent_silver_table],
        environment=environment,
        description=f"Gold layer for {job_slug}",
    )


def update_job_execution_metrics(
    job_id: str,
    bronze_records: Optional[int] = None,
    silver_records: Optional[int] = None,
    gold_records: Optional[int] = None,
    quarantined_records: Optional[int] = None,
) -> None:
    """
    Update record counts for a job execution in the database.

    This function finds the most recent job_execution for the given job_id
    and updates the bronze_records, silver_records, gold_records, and/or quarantined_records columns.

    Args:
        job_id: Job ID
        bronze_records: Number of bronze records (optional)
        silver_records: Number of silver records (optional)
        gold_records: Number of gold records (optional)
        quarantined_records: Number of quarantined records (optional)
    """
    logger = _logger()
    conn = get_database_connection()
    cursor = conn.cursor()

    try:
        # Find the most recent job_execution for this job_id
        cursor.execute(
            """
            SELECT id FROM job_executions
            WHERE job_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (job_id,)
        )
        result = cursor.fetchone()

        if not result:
            logger.warning(f"No job_execution found for job_id={job_id}")
            return

        job_execution_id = result[0]

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

        # Add job_execution_id to params
        params.append(job_execution_id)

        # Execute UPDATE
        query = f"UPDATE job_executions SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        conn.commit()

        logger.info(f"✅ Updated job_execution metrics for job_id={job_id}: bronze={bronze_records}, silver={silver_records}, gold={gold_records}")

    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Failed to update job_execution metrics: {e}")
        raise
    finally:
        conn.close()
