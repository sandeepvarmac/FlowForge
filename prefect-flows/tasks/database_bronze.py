"""
Database Bronze Layer Ingestion Task
Reads data from databases (SQL Server, PostgreSQL, etc.) and writes to Bronze layer in Parquet format.
"""

from prefect import task
from datetime import datetime
import pyarrow as pa
import pyarrow.parquet as pq
import uuid
from typing import Dict, Any, Optional
import os
import tempfile

from utils.database_connectors import SQLServerConnector, PostgreSQLConnector, MySQLConnector
from utils.s3 import S3Client
from utils.ai_quality_profiler import AIQualityProfiler
from utils.metadata_catalog import catalog_bronze_asset, update_job_execution_metrics
import polars as pl
import requests


@task(name="ingest-from-database", retries=2, retry_delay_seconds=30)
def ingest_from_database(
    workflow_id: str,
    job_id: str,
    workflow_slug: str,
    job_slug: str,
    run_id: str,
    source_config: Dict[str, Any],
    destination_config: Optional[Dict[str, Any]],
    batch_id: str,
    execution_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Ingest data from database to Bronze layer Parquet files

    Args:
        job_id: FlowForge job ID
        source_config: {
            "type": "sql-server" | "postgresql" | "mysql",
            "connection": {
                "host": str,
                "port": int,
                "database": str,
                "username": str,
                "password": str
            },
            "databaseConfig": {
                "tableName": str (optional),
                "query": str (optional),
                "storedProcedure": str (optional),
                "isIncremental": bool,
                "deltaColumn": str (optional),
                "lastWatermark": str (optional)
            }
        }
        destination_config: {
            "bronzeConfig": {
                "tableName": str,
                "storageFormat": "parquet",
                "loadStrategy": "append" | "full_refresh" | "incremental",
                "auditColumns": bool,
                "compression": "snappy" | "gzip" | "zstd"
            }
        }
        batch_id: Unique batch identifier
        execution_id: Optional execution ID for tracking

    Returns:
        {
            "status": "success" | "failed",
            "records_processed": int,
            "bronze_file_path": str,
            "file_size_bytes": int,
            "schema": list,
            "watermark_value": str (if incremental)
        }
    """
    try:
        print(f"\n{'='*60}")
        print(f"Database Bronze Ingestion - Job: {job_id}")
        print(f"{'='*60}\n")

        # Extract configuration
        db_type = source_config.get('type')
        connection_config = source_config.get('connection', {})
        database_config = source_config.get('databaseConfig', {})
        destination_config = destination_config or {}
        bronze_config = destination_config.get('bronzeConfig', {}) or {}

        # Initialize database connector
        print(f"1. Initializing {db_type} connector...")
        connector = _get_connector(db_type, connection_config)
        print(f"   Connected to: {connection_config.get('database')}")

        # Determine what to read
        table_name = database_config.get('tableName')
        custom_query = database_config.get('query')
        is_incremental = database_config.get('isIncremental', False)
        delta_column = database_config.get('deltaColumn')
        last_watermark = database_config.get('lastWatermark')

        # Read data from database
        print(f"\n2. Reading data from database...")
        if custom_query:
            print(f"   Executing custom query: {custom_query[:100]}...")
            arrow_table = connector.read_query(custom_query)
        elif is_incremental and delta_column and last_watermark:
            print(f"   Incremental load from: {table_name}")
            print(f"   Delta column: {delta_column}, Last watermark: {last_watermark}")
            arrow_table = connector.get_incremental_data(
                table_name=table_name,
                delta_column=delta_column,
                last_value=last_watermark
            )
        else:
            print(f"   Full load from table: {table_name}")
            arrow_table = connector.read_table(table_name)

        # Close connector
        connector.close()

        # Check if data is empty
        if arrow_table.num_rows == 0:
            print(f"   WARNING: No data returned from source")
            return {
                "status": "success",
                "records_processed": 0,
                "bronze_file_path": None,
                "file_size_bytes": 0,
                "message": "No new data to process"
            }

        print(f"   Records read: {arrow_table.num_rows}")
        print(f"   Columns: {arrow_table.num_columns}")
        print(f"   Memory size: {arrow_table.nbytes / 1024:.2f} KB")

        # Add audit columns
        if bronze_config.get('auditColumns', True):
            print(f"\n3. Adding audit columns...")
            arrow_table = _add_audit_columns(
                arrow_table,
                batch_id=batch_id,
                source_system=db_type,
                source_file=table_name or 'custom_query'
            )
            print(f"   Added 5 audit columns")

        # Prepare output path
        bronze_table_name = bronze_config.get('tableName') or f"{workflow_slug}_{job_slug}_bronze"
        date_folder = datetime.utcnow().strftime("%Y%m%d")
        output_filename = bronze_config.get('fileName') or f"{workflow_slug}_{job_slug}_{run_id}_v001.parquet"
        s3_key = bronze_config.get('s3Key') or f"bronze/{workflow_slug}/{job_slug}/{date_folder}/{output_filename}"

        # Write to Parquet locally first
        print(f"\n4. Writing to Parquet...")
        temp_dir = tempfile.gettempdir()
        local_temp_path = os.path.join(temp_dir, output_filename)
        compression = bronze_config.get('compression', 'snappy')

        pq.write_table(
            arrow_table,
            local_temp_path,
            compression=compression,
            use_dictionary=True,
            write_statistics=True
        )

        file_size = os.path.getsize(local_temp_path)
        print(f"   File size: {file_size / 1024:.2f} KB")
        print(f"   Compression: {compression}")

        # Upload to S3/MinIO
        print(f"\n5. Uploading to MinIO...")
        print(f"   S3 Key: {s3_key}")

        s3_client = S3Client()
        s3_url = s3_client.upload_file(
            local_path=local_temp_path,
            s3_key=s3_key
        )
        print(f"   Upload complete: {s3_url}")

        # Clean up local file
        os.remove(local_temp_path)

        # Calculate new watermark if incremental
        watermark_value = None
        if is_incremental and delta_column:
            # Get max value of delta column
            watermark_value = _get_max_watermark(arrow_table, delta_column)
            print(f"\n6. New watermark: {delta_column} = {watermark_value}")

        row_count = arrow_table.num_rows
        column_names = [field.name for field in arrow_table.schema]

        # Prepare result payload required by downstream Silver/Gold tasks
        result = {
            "status": "success",
            "workflow_id": workflow_id,
            "job_id": job_id,
            "workflow_slug": workflow_slug,
            "job_slug": job_slug,
            "run_id": run_id,
            "records": row_count,
            "columns": column_names,
            "records_processed": row_count,
            "bronze_file_path": s3_url,
            "bronze_key": s3_key,
            "bronze_filename": os.path.basename(s3_key),
            "file_size_bytes": file_size,
            "schema": [
                {
                    "name": field.name,
                    "type": str(field.type)
                }
                for field in arrow_table.schema
            ],
            "compression": compression,
            "table_name": bronze_table_name,
        }

        if watermark_value:
            result["watermark_value"] = watermark_value

        # Convert to Polars for downstream processing (metadata + AI)
        df_polars = pl.from_arrow(arrow_table)

        # Catalog dataset in FlowForge metadata store
        try:
            asset_id = catalog_bronze_asset(
                job_id=job_id,
                workflow_slug=workflow_slug,
                job_slug=job_slug,
                s3_key=s3_key,
                row_count=row_count,
                dataframe=df_polars,
                environment=os.getenv("FLOWFORGE_ENVIRONMENT", "prod"),
            )
            print(f"   Cataloged bronze asset: {asset_id}")
        except Exception as e:
            print(f"   WARNING: Failed to catalog bronze metadata: {e}")

        # Update job execution metrics for UI dashboards
        try:
            update_job_execution_metrics(
                job_id=job_id,
                bronze_records=row_count,
            )
            print(f"   Updated job execution metrics (bronze_records={row_count})")
        except Exception as e:
            print(f"   WARNING: Failed to update job execution metrics: {e}")

        # Run AI Quality Profiler to generate quality rule suggestions
        try:
            print(f"\n7. Running AI Quality Profiler...")
            profiler = AIQualityProfiler()

            # Use bronze table name for profiling
            profiling_result = profiler.profile_dataframe(df_polars, bronze_table_name)

            print(f"   AI Profiling complete:")
            print(f"   - Column count: {profiling_result['column_count']}")
            print(f"   - Suggested rules: {len(profiling_result['ai_suggestions'].get('quality_rules', []))}")

            # Save suggested rules to database via API
            suggested_rules = profiling_result['ai_suggestions'].get('quality_rules', [])
            if suggested_rules:
                print(f"   Saving {len(suggested_rules)} AI-suggested quality rules...")
                _save_quality_rules_to_db(job_id, suggested_rules)

        except Exception as e:
            print(f"   WARNING: AI Quality Profiler failed (non-blocking): {e}")
            import traceback
            traceback.print_exc()

        print(f"\n{'='*60}")
        print(f"Database Bronze Ingestion Complete")
        print(f"Status: SUCCESS")
        print(f"Records: {arrow_table.num_rows}")
        print(f"File: {s3_url}")
        print(f"{'='*60}\n")

        return result

    except Exception as e:
        error_msg = f"Database bronze ingestion failed: {str(e)}"
        print(f"\nERROR: {error_msg}")
        import traceback
        traceback.print_exc()

        return {
            "status": "failed",
            "error": error_msg,
            "records_processed": 0
        }


def _get_connector(db_type: str, connection_config: Dict[str, Any]):
    """
    Get appropriate database connector based on type

    Args:
        db_type: Database type (sql-server, postgresql, mysql)
        connection_config: Connection parameters

    Returns:
        DatabaseConnector instance
    """
    if db_type == 'sql-server':
        return SQLServerConnector(
            host=connection_config.get('host', 'localhost'),
            port=connection_config.get('port', 1433),
            database=connection_config.get('database'),
            username=connection_config.get('username'),
            password=connection_config.get('password'),
            timeout=connection_config.get('timeout', 30)
        )
    elif db_type == 'postgresql':
        return PostgreSQLConnector(
            host=connection_config.get('host', 'localhost'),
            port=connection_config.get('port', 5432),
            database=connection_config.get('database'),
            username=connection_config.get('username'),
            password=connection_config.get('password'),
            timeout=connection_config.get('timeout', 30)
        )
    elif db_type == 'mysql':
        # Placeholder for future implementation
        raise NotImplementedError("MySQL connector not yet implemented")
    else:
        raise ValueError(f"Unsupported database type: {db_type}")


def _add_audit_columns(
    arrow_table: pa.Table,
    batch_id: str,
    source_system: str,
    source_file: str
) -> pa.Table:
    """
    Add audit columns to Arrow table

    Args:
        arrow_table: Original Arrow table
        batch_id: Unique batch identifier
        source_system: Source system name (e.g., 'sql-server')
        source_file: Source table/file name

    Returns:
        Arrow table with audit columns added
    """
    num_rows = arrow_table.num_rows
    current_time = datetime.now()

    # Create audit columns
    audit_columns = {
        '_batch_id': pa.array([batch_id] * num_rows, type=pa.string()),
        '_ingestion_time': pa.array([current_time] * num_rows, type=pa.timestamp('ms')),
        '_source_system': pa.array([source_system] * num_rows, type=pa.string()),
        '_source_file': pa.array([source_file] * num_rows, type=pa.string()),
        '_file_modified_time': pa.array([current_time] * num_rows, type=pa.timestamp('ms'))
    }

    # Append audit columns to table
    for col_name, col_data in audit_columns.items():
        arrow_table = arrow_table.append_column(col_name, col_data)

    return arrow_table


def _get_max_watermark(arrow_table: pa.Table, column_name: str) -> Any:
    """
    Get maximum value from a column (for watermarking)

    Args:
        arrow_table: Arrow table
        column_name: Column to get max value from

    Returns:
        Maximum value from column
    """
    try:
        column = arrow_table.column(column_name)
        max_value = pa.compute.max(column).as_py()

        # Convert to string if datetime
        if isinstance(max_value, datetime):
            return max_value.isoformat()

        return str(max_value)

    except Exception as e:
        print(f"Warning: Could not compute watermark: {e}")
        return None


def _save_quality_rules_to_db(job_id: str, suggested_rules: list):
    """
    Save AI-suggested quality rules to database via Quality API

    Args:
        job_id: FlowForge job ID
        suggested_rules: List of quality rule suggestions from AI profiler
    """
    import json

    # Get API base URL from environment (default to localhost)
    api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
    api_url = f"{api_base_url}/api/quality/rules"

    saved_count = 0
    for rule in suggested_rules:
        try:
            # Prepare rule payload for API
            payload = {
                "job_id": job_id,
                "rule_id": rule.get("rule_id"),
                "rule_name": rule.get("rule_id", "").replace("_", " ").title(),
                "column_name": rule.get("column"),
                "rule_type": rule.get("rule_type"),
                "parameters": rule.get("pattern") or rule.get("min") or rule.get("max") or rule.get("allowed_values"),
                "confidence": rule.get("confidence", 0),
                "current_compliance": rule.get("current_compliance", ""),
                "reasoning": rule.get("reasoning", ""),
                "ai_generated": 1,
                "severity": rule.get("severity", "error"),
            }

            # Convert parameters to JSON string if it's a dict/list
            if isinstance(payload["parameters"], (dict, list)):
                payload["parameters"] = json.dumps(payload["parameters"])

            # Call API to save rule
            response = requests.post(api_url, json=payload, timeout=10)
            if response.status_code == 200:
                saved_count += 1
                print(f"     ✓ Saved rule: {payload['rule_id']}")
            else:
                print(f"     ✗ Failed to save rule {payload['rule_id']}: {response.status_code}")

        except Exception as e:
            print(f"     ✗ Error saving rule: {e}")

    print(f"   Saved {saved_count}/{len(suggested_rules)} quality rules to database")


@task(name="test-database-connection")
def test_database_connection(
    db_type: str,
    connection_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Test database connection (for UI "Test Connection" button)

    Args:
        db_type: Database type
        connection_config: Connection parameters

    Returns:
        {
            "success": bool,
            "message": str,
            "server_version": str (if success),
            "database": str (if success)
        }
    """
    try:
        connector = _get_connector(db_type, connection_config)
        result = connector.test_connection()
        connector.close()
        return result

    except Exception as e:
        return {
            "success": False,
            "message": f"Connection test failed: {str(e)}"
        }


@task(name="list-database-tables")
def list_database_tables(
    db_type: str,
    connection_config: Dict[str, Any]
) -> Dict[str, Any]:
    """
    List all tables in database (for UI table selector)

    Args:
        db_type: Database type
        connection_config: Connection parameters

    Returns:
        {
            "success": bool,
            "tables": list of str,
            "count": int
        }
    """
    try:
        connector = _get_connector(db_type, connection_config)
        tables = connector.list_tables()
        connector.close()

        return {
            "success": True,
            "tables": tables,
            "count": len(tables)
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "tables": [],
            "count": 0
        }


@task(name="get-database-schema")
def get_database_schema(
    db_type: str,
    connection_config: Dict[str, Any],
    table_name: str
) -> Dict[str, Any]:
    """
    Get schema for a specific table (for UI schema preview)

    Args:
        db_type: Database type
        connection_config: Connection parameters
        table_name: Table name

    Returns:
        {
            "success": bool,
            "schema": list of column info,
            "row_count": int,
            "preview": list of sample rows
        }
    """
    try:
        connector = _get_connector(db_type, connection_config)

        schema = connector.get_schema(table_name)
        row_count = connector.get_row_count(table_name)

        # Fetch preview data (first 20 rows)
        preview_data = connector.preview_data(table_name, limit=20)

        # Detect temporal columns (for incremental loading)
        temporal_columns = _detect_temporal_columns(schema)

        # Detect primary key candidates
        pk_candidates = _detect_pk_candidates(schema)

        connector.close()

        return {
            "success": True,
            "schema": schema,
            "row_count": row_count,
            "preview": preview_data,
            "table_name": table_name,
            "metadata": {
                "temporal_columns": temporal_columns,
                "pk_candidates": pk_candidates
            }
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "schema": [],
            "row_count": 0,
            "preview": [],
            "metadata": {
                "temporal_columns": [],
                "pk_candidates": []
            }
        }


@task(name="preview-database-table")
def preview_database_table(
    db_type: str,
    connection_config: Dict[str, Any],
    table_name: str,
    limit: int = 100
) -> Dict[str, Any]:
    """
    Preview sample rows from a database table (for UI data preview)

    Args:
        db_type: Database type
        connection_config: Connection parameters
        table_name: Table name
        limit: Maximum number of rows to return (default 100)

    Returns:
        {
            "success": bool,
            "schema": list of column info,
            "rows": list of dicts (row data),
            "total_rows": int (in sample),
            "row_count": int (total in table)
        }
    """
    try:
        connector = _get_connector(db_type, connection_config)

        # Get schema
        schema = connector.get_schema(table_name)

        # Get row count
        row_count = connector.get_row_count(table_name)

        # Read sample data
        query = f"SELECT * FROM {table_name} LIMIT {limit}"
        arrow_table = connector.read_query(query)

        # Convert to list of dicts
        df = pl.from_arrow(arrow_table)
        rows = df.to_dicts()

        connector.close()

        return {
            "success": True,
            "schema": schema,
            "rows": rows,
            "total_rows": len(rows),
            "row_count": row_count,
            "table_name": table_name
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "error": str(e),
            "schema": [],
            "rows": [],
            "total_rows": 0,
            "row_count": 0
        }


def get_sample_data(
    db_type: str,
    connection_config: Dict[str, Any],
    table_name: str,
    sample_size: int = 1000
) -> Dict[str, Any]:
    """
    Get sample data from database table for AI analysis

    Args:
        db_type: Database type (sql-server, postgresql, mysql)
        connection_config: Connection configuration dictionary
        table_name: Name of the table to sample
        sample_size: Number of rows to sample (default 1000)

    Returns:
        Dictionary with success status and Polars DataFrame
    """
    try:
        connector = _get_connector(db_type, connection_config)

        # Read sample data
        query = f"SELECT * FROM {table_name} LIMIT {sample_size}"
        arrow_table = connector.read_query(query)

        # Convert to Polars DataFrame
        df = pl.from_arrow(arrow_table)

        connector.close()

        return {
            "success": True,
            "dataframe": df,
            "row_count": len(df),
            "column_count": len(df.columns),
            "message": f"Sampled {len(df)} rows from {table_name}"
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "success": False,
            "message": f"Failed to sample data: {str(e)}",
            "dataframe": None,
            "row_count": 0,
            "column_count": 0
        }


# ========== Helper Functions for Schema Intelligence ==========

def _detect_temporal_columns(schema: list) -> list:
    """
    Detect columns that are suitable for incremental loading (timestamps, dates)

    Args:
        schema: List of column dictionaries with 'name' and 'type'

    Returns:
        List of column names that are temporal
    """
    temporal_patterns = ['created', 'updated', 'modified', 'timestamp', 'date', 'time']
    temporal_types = ['timestamp', 'datetime', 'date', 'time']

    candidates = []

    for col in schema:
        col_name = col.get('name', '').lower()
        col_type = col.get('type', '').lower()

        # Check if column name contains temporal keywords
        if any(pattern in col_name for pattern in temporal_patterns):
            candidates.append(col['name'])
        # Check if column type is temporal
        elif any(t in col_type for t in temporal_types):
            candidates.append(col['name'])

    return candidates


def _detect_pk_candidates(schema: list) -> list:
    """
    Detect columns that are likely primary keys

    Args:
        schema: List of column dictionaries with 'name' and 'type'

    Returns:
        List of column names that are PK candidates
    """
    pk_patterns = ['id', '_id', 'key', 'pk', 'code']

    candidates = []

    for col in schema:
        col_name = col.get('name', '').lower()

        # Check if column name matches PK patterns
        if col_name in pk_patterns or col_name.endswith('_id') or col_name.startswith('id_'):
            candidates.append(col['name'])

    return candidates
