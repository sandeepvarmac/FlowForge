"""Parquet and CSV helper utilities for FlowForge Prefect pipelines."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Iterable, Sequence

import polars as pl


def read_csv(path: str | Path, *, has_header: bool = True, infer_schema_length: int | None = None) -> pl.DataFrame:
    """Read a CSV file into a Polars DataFrame.

    Args:
        path: Local path to the CSV file.
        has_header: Whether the CSV file has a header row (default: True).
                   If False, Polars auto-generates column names: column_1, column_2, etc.
        infer_schema_length: Optional number of rows used for schema inference.

    Returns:
        Polars DataFrame with the CSV content.
    """
    return pl.read_csv(
        path,
        has_header=has_header,
        try_parse_dates=True,
        infer_schema_length=infer_schema_length,
        ignore_errors=False,
    )


def add_audit_columns(
    df: pl.DataFrame,
    *,
    source_file: str,
    include_row_number: bool = True,
    timestamp: datetime | None = None,
) -> pl.DataFrame:
    """Append FlowForge audit columns to a DataFrame.

    Args:
        df: Input DataFrame.
        source_file: Original file name (stored in `_source_file`).
        include_row_number: When True add `_row_number` column (1-based).
        timestamp: Optional timestamp (defaults to `datetime.utcnow`).

    Returns:
        DataFrame enriched with audit columns.
    """
    ts = timestamp or datetime.utcnow()
    columns: list[pl.Series] = [
        pl.Series("_ingested_at", [ts.isoformat()] * df.height),
        pl.Series("_source_file", [source_file] * df.height),
    ]
    if include_row_number:
        columns.append(pl.Series("_row_number", list(range(1, df.height + 1))))

    audit_df = pl.DataFrame(columns)
    return pl.concat([df, audit_df], how="horizontal")


def ensure_columns(df: pl.DataFrame, required: Sequence[str]) -> None:
    """Validate that required columns exist, raise helpful error otherwise."""
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {', '.join(missing)}")


def write_parquet(df: pl.DataFrame, path: str | Path) -> Path:
    """Write a DataFrame to Parquet and return the target Path."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    df.write_parquet(path, compression="zstd")
    return path


def read_parquet(path: str | Path) -> pl.DataFrame:
    """Read Parquet into a Polars DataFrame."""
    return pl.read_parquet(path)


def deduplicate(
    df: pl.DataFrame,
    *,
    subset: Iterable[str] | None = None,
    keep: str = "last",
) -> pl.DataFrame:
    """Drop duplicate rows using Polars `unique` semantics."""
    return df.unique(subset=subset, keep=keep)


def add_surrogate_key(
    df: pl.DataFrame,
    *,
    key_column: str = "_sk_id",
    start: int = 1,
) -> pl.DataFrame:
    """Attach an auto-incrementing surrogate key column."""
    return df.with_columns(pl.Series(key_column, range(start, start + df.height)))
