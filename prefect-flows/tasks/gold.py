from __future__ import annotations

from datetime import datetime
from pathlib import Path
import tempfile

import polars as pl
from prefect import task, get_run_logger

from utils.duckdb_helper import (
    create_snowflake_schema,
    export_query_to_parquet,
    get_connection,
    load_dimension,
)
from utils.parquet_utils import read_parquet, write_parquet
from utils.s3 import S3Client


@task(name="gold_publish")
def gold_publish(silver_result: dict) -> dict:
    """Publish analytics outputs to the Gold layer."""

    logger = get_run_logger()
    s3 = S3Client()

    workflow_id = silver_result["workflow_id"]
    job_id = silver_result["job_id"]
    silver_key = silver_result["silver_key"]

    gold_prefix = f"gold/{workflow_id}/{job_id}"
    metrics_key = f"{gold_prefix}/metrics.parquet"
    country_key = f"{gold_prefix}/country_breakdown.parquet"

    logger.info("Building Gold outputs from Silver %s", silver_key)

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        local_silver = tmp_path / "silver.parquet"
        s3.download_file(silver_key, local_silver)

        df = read_parquet(local_silver)

        metrics_df = pl.DataFrame(
            {
                "metric": ["records", "columns", "generated_at"],
                "value": [df.height, len(df.columns), datetime.utcnow().isoformat()],
            }
        )
        metrics_local = tmp_path / "metrics.parquet"
        write_parquet(metrics_df, metrics_local)
        s3.upload_file(metrics_local, metrics_key)

        country_upload_key: str | None = None
        if "country" in df.columns:
            country_df = (
                df.group_by("country")
                .agg(pl.len().alias("records"))
                .sort("records", descending=True)
            )
            country_local = tmp_path / "country_breakdown.parquet"
            write_parquet(country_df, country_local)
            s3.upload_file(country_local, country_key)
            country_upload_key = country_key
            logger.info("Uploaded Gold country breakdown to %s", country_key)

        required_dim_cols = {"_sk_id", "customer_id", "first_name", "last_name", "email"}
        if required_dim_cols.issubset(df.columns):
            logger.info("Loading dim_customer table into DuckDB")
            dim_df = df
            if "country" not in dim_df.columns:
                dim_df = dim_df.with_columns(pl.lit(None).alias("country"))
            if "loyalty_tier" not in dim_df.columns:
                dim_df = dim_df.with_columns(pl.lit(None).alias("loyalty_tier"))

            dim_df = dim_df.select(
                pl.col("_sk_id").alias("customer_key"),
                "customer_id",
                "first_name",
                "last_name",
                pl.col("email").fill_null("").alias("email"),
                pl.col("country").fill_null("").alias("country"),
                pl.col("loyalty_tier").fill_null("").alias("loyalty_tier"),
                pl.lit(datetime.utcnow()).alias("updated_at"),
            )

            with get_connection() as conn:
                create_snowflake_schema(conn)
                load_dimension(conn, "dim_customer", dim_df)
                gold_table_path = tmp_path / "dim_customer.parquet"
                export_query_to_parquet(
                    conn,
                    "SELECT * FROM dim_customer ORDER BY customer_key",
                    gold_table_path,
                )
                s3.upload_file(gold_table_path, f"{gold_prefix}/dim_customer.parquet")

    return {
        "workflow_id": workflow_id,
        "job_id": job_id,
        "metrics_key": metrics_key,
        "country_key": country_upload_key,
        "silver_key": silver_key,
    }
