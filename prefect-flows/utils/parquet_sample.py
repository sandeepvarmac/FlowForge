"""
Parquet Sample Data Reader
Utility to read first N rows from Parquet files in MinIO
"""

import sys
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Any
import polars as pl

from utils.s3 import S3Client


def get_sample_data(s3_key: str, limit: int = 100) -> Dict[str, Any]:
    """
    Read first N rows from a Parquet file in S3.

    Args:
        s3_key: S3 key of the Parquet file (can include s3:// prefix)
        limit: Number of rows to return (default: 100)

    Returns:
        Dict with schema, rows, and metadata
    """
    s3 = S3Client()

    # Remove s3:// prefix if present
    if s3_key.startswith('s3://'):
        # Parse s3://bucket/key format
        parts = s3_key.replace('s3://', '').split('/', 1)
        if len(parts) == 2:
            s3_key = parts[1]  # Extract just the key part

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_dir_path = Path(tmp_dir)
        local_file = tmp_dir_path / Path(s3_key).name

        # Download Parquet file from S3
        s3.download_file(s3_key, local_file)

        # Read first N rows using Polars
        df = pl.read_parquet(local_file, n_rows=limit)

        # Convert to list of dictionaries for JSON serialization
        rows = df.to_dicts()

        # Get column names and types
        schema = [
            {
                "name": col,
                "type": str(df.schema[col])
            }
            for col in df.columns
        ]

        return {
            "schema": schema,
            "rows": rows,
            "total_rows_in_sample": df.height,
            "total_columns": df.width,
        }


def main():
    """
    CLI interface for testing
    Usage: python parquet_sample.py <s3_key> [limit]
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python parquet_sample.py <s3_key> [limit]"
        }))
        sys.exit(1)

    s3_key = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 100

    try:
        result = get_sample_data(s3_key, limit)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
