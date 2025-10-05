"""DuckDB helper utilities for the FlowForge medallion pipeline."""

from __future__ import annotations

from pathlib import Path

import duckdb
import polars as pl

from .config import settings


def get_connection(readonly: bool = False) -> duckdb.DuckDBPyConnection:
    """Create (and configure) a DuckDB connection."""

    duckdb_path = Path(settings.duckdb_path)
    duckdb_path.parent.mkdir(parents=True, exist_ok=True)

    conn = duckdb.connect(str(duckdb_path), read_only=readonly)
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

    return conn


def create_snowflake_schema(conn: duckdb.DuckDBPyConnection) -> None:
    """Create basic dimension/fact tables if they do not yet exist."""

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
    """Replace the content of a dimension table with the provided DataFrame."""
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
    """Execute a query and write the result to a Parquet file."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    conn.execute(
        "COPY (" + query + ") TO '" + str(output_path) + "' (FORMAT PARQUET, COMPRESSION ZSTD);"
    )
    return output_path
