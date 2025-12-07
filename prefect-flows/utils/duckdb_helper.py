"""DuckDB helper utilities for the FlowForge medallion pipeline."""

from __future__ import annotations

from pathlib import Path
from typing import Optional
from datetime import datetime

import duckdb
import polars as pl

from .config import settings


def get_connection(readonly: bool = False) -> duckdb.DuckDBPyConnection:
    """Create (and configure) a DuckDB connection."""

    duckdb_path = Path(settings.duckdb_path)
    duckdb_path.parent.mkdir(parents=True, exist_ok=True)

    conn = duckdb.connect(str(duckdb_path), read_only=readonly)

    # Install and load httpfs extension for S3 access
    try:
        conn.execute("INSTALL httpfs;")
        conn.execute("LOAD httpfs;")

        endpoint = settings.s3_endpoint_url.replace("http://", "").replace("https://", "")
        conn.execute(f"SET s3_endpoint='{endpoint}';")
        conn.execute("SET s3_url_style='path';")
        use_ssl = "true" if "amazonaws.com" in settings.s3_endpoint_url else "false"
        conn.execute(f"SET s3_use_ssl={use_ssl};")
        conn.execute(f"SET s3_access_key_id='{settings.s3_access_key_id}';")
        conn.execute(f"SET s3_secret_access_key='{settings.s3_secret_access_key}';")
        conn.execute(f"SET s3_region='{settings.s3_region}';")
    except Exception as e:
        # httpfs may not be available in all DuckDB builds
        print(f"Warning: Could not configure S3 access: {e}")

    return conn


def create_table_from_dataframe(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
    df: pl.DataFrame,
    replace: bool = True,
) -> int:
    """
    Create a DuckDB table from a Polars DataFrame.

    Args:
        conn: DuckDB connection
        table_name: Name of the table to create
        df: Polars DataFrame with data
        replace: If True, drop and recreate table; if False, append

    Returns:
        Number of rows inserted
    """
    # Sanitize table name
    safe_table_name = table_name.replace("-", "_").replace(" ", "_").lower()

    if replace:
        conn.execute(f"DROP TABLE IF EXISTS {safe_table_name};")

    # Register the DataFrame and create table
    conn.register("temp_df", df.to_pandas())

    if replace:
        conn.execute(f"CREATE TABLE {safe_table_name} AS SELECT * FROM temp_df;")
    else:
        # Check if table exists, create if not
        result = conn.execute(
            f"SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '{safe_table_name}'"
        ).fetchone()
        if result[0] == 0:
            conn.execute(f"CREATE TABLE {safe_table_name} AS SELECT * FROM temp_df;")
        else:
            conn.execute(f"INSERT INTO {safe_table_name} SELECT * FROM temp_df;")

    conn.unregister("temp_df")
    return len(df)


def create_gold_view(
    conn: duckdb.DuckDBPyConnection,
    view_name: str,
    source_table: str,
    select_columns: Optional[list[str]] = None,
    aggregations: Optional[dict] = None,
    group_by: Optional[list[str]] = None,
) -> str:
    """
    Create an analytics view in the Gold layer.

    Args:
        conn: DuckDB connection
        view_name: Name of the view to create
        source_table: Source table name
        select_columns: Columns to select (defaults to all)
        aggregations: Dict of {output_col: "AGG(source_col)"} for aggregations
        group_by: Columns to group by (for aggregations)

    Returns:
        The SQL query used to create the view
    """
    safe_view_name = view_name.replace("-", "_").replace(" ", "_").lower()
    safe_source = source_table.replace("-", "_").replace(" ", "_").lower()

    if aggregations and group_by:
        # Aggregation view
        group_cols = ", ".join(group_by)
        agg_cols = ", ".join([f"{agg} AS {col}" for col, agg in aggregations.items()])
        query = f"""
        CREATE OR REPLACE VIEW {safe_view_name} AS
        SELECT {group_cols}, {agg_cols}
        FROM {safe_source}
        GROUP BY {group_cols}
        """
    elif select_columns:
        # Simple column selection
        cols = ", ".join(select_columns)
        query = f"""
        CREATE OR REPLACE VIEW {safe_view_name} AS
        SELECT {cols}
        FROM {safe_source}
        """
    else:
        # Default: select all
        query = f"""
        CREATE OR REPLACE VIEW {safe_view_name} AS
        SELECT *
        FROM {safe_source}
        """

    conn.execute(query)
    return query.strip()


def export_to_parquet(
    conn: duckdb.DuckDBPyConnection,
    source: str,
    output_path: Path,
    is_query: bool = False,
) -> Path:
    """
    Export a table or query result to a Parquet file.

    Args:
        conn: DuckDB connection
        source: Table name or SQL query
        output_path: Path for the output Parquet file
        is_query: If True, treat source as a SQL query

    Returns:
        Path to the created Parquet file
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if is_query:
        sql = f"COPY ({source}) TO '{str(output_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);"
    else:
        safe_source = source.replace("-", "_").replace(" ", "_").lower()
        sql = f"COPY {safe_source} TO '{str(output_path)}' (FORMAT PARQUET, COMPRESSION ZSTD);"

    conn.execute(sql)
    return output_path


def get_table_stats(
    conn: duckdb.DuckDBPyConnection,
    table_name: str,
) -> dict:
    """
    Get statistics for a DuckDB table.

    Args:
        conn: DuckDB connection
        table_name: Name of the table

    Returns:
        Dictionary with table statistics
    """
    safe_table = table_name.replace("-", "_").replace(" ", "_").lower()

    try:
        # Get row count
        row_count = conn.execute(f"SELECT COUNT(*) FROM {safe_table}").fetchone()[0]

        # Get column info
        columns = conn.execute(f"DESCRIBE {safe_table}").fetchall()

        return {
            "table_name": safe_table,
            "row_count": row_count,
            "columns": [{"name": col[0], "type": col[1]} for col in columns],
            "column_count": len(columns),
        }
    except Exception as e:
        return {
            "table_name": safe_table,
            "error": str(e),
        }


def list_tables(conn: duckdb.DuckDBPyConnection) -> list[str]:
    """List all tables in the DuckDB database."""
    result = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'"
    ).fetchall()
    return [row[0] for row in result]


def list_views(conn: duckdb.DuckDBPyConnection) -> list[str]:
    """List all views in the DuckDB database."""
    result = conn.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_type = 'VIEW'"
    ).fetchall()
    return [row[0] for row in result]


# Legacy functions for backwards compatibility
def create_snowflake_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """Create basic dimension/fact tables if they do not yet exist (legacy)."""
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS dim_customer (
            customer_key INTEGER PRIMARY KEY,
            customer_id VARCHAR,
            first_name VARCHAR,
            last_name VARCHAR,
            email VARCHAR,
            country VARCHAR,
            loyalty_tier VARCHAR,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS fact_order_metrics (
            order_date DATE,
            orders INTEGER,
            total_amount DOUBLE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """
    )


def load_dimension(
    conn: duckdb.DuckDBPyConnection,
    table: str,
    df: pl.DataFrame,
) -> int:
    """Replace the content of a dimension table with the provided DataFrame (legacy)."""
    conn.execute(f"DELETE FROM {table};")
    conn.register("dim_df", df.to_pandas())
    conn.execute(f"INSERT INTO {table} SELECT * FROM dim_df;")
    conn.unregister("dim_df")
    return df.height


def export_query_to_parquet(
    conn: duckdb.DuckDBPyConnection,
    query: str,
    output_path: Path,
) -> Path:
    """Execute a query and write the result to a Parquet file (legacy)."""
    return export_to_parquet(conn, query, output_path, is_query=True)
