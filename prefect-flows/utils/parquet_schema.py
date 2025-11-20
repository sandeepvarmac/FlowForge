"""
Parquet Schema Reader
Utility to read schema information from Parquet files in MinIO
"""

import sys
import json
import tempfile
from pathlib import Path
from typing import Dict, List, Any
import polars as pl

from utils.s3 import S3Client


def get_schema(s3_key: str) -> Dict[str, Any]:
    """
    Read schema from a Parquet file in S3.

    Args:
        s3_key: S3 key of the Parquet file (can include s3:// prefix)

    Returns:
        Dict with columns schema information
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

        # Read Parquet file schema using Polars (no data reading)
        df = pl.read_parquet(local_file, n_rows=0)

        # Build column schema with detailed type information
        columns = []
        for col_name in df.columns:
            col_type = df.schema[col_name]

            # Get Polars data type details
            type_str = str(col_type)

            # Map to more user-friendly type names
            if 'Int' in type_str:
                friendly_type = 'Integer'
            elif 'Float' in type_str or 'Decimal' in type_str:
                friendly_type = 'Decimal'
            elif 'Utf8' in type_str or 'String' in type_str:
                friendly_type = 'String'
            elif 'Date' in type_str:
                friendly_type = 'Date'
            elif 'Datetime' in type_str:
                friendly_type = 'DateTime'
            elif 'Boolean' in type_str or 'Bool' in type_str:
                friendly_type = 'Boolean'
            else:
                friendly_type = type_str

            columns.append({
                "name": col_name,
                "type": friendly_type,
                "raw_type": type_str,
                "nullable": True  # Parquet generally allows nulls unless explicitly stated
            })

        return {
            "columns": columns,
            "total_columns": len(columns)
        }


def main():
    """
    CLI interface for testing
    Usage: python -m utils.parquet_schema <s3_key>
    """
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: python -m utils.parquet_schema <s3_key>"
        }))
        sys.exit(1)

    s3_key = sys.argv[1]

    try:
        result = get_schema(s3_key)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "type": type(e).__name__
        }))
        sys.exit(1)


if __name__ == "__main__":
    main()
