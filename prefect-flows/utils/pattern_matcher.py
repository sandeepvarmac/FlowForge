"""
Pattern matching utility for file discovery in S3/MinIO.
Supports glob-style patterns like customer_*.csv, sales_2024*.json, etc.
"""

import fnmatch
import logging
from typing import List, Dict, Any
from pathlib import Path

from utils.s3 import S3Client

logger = logging.getLogger(__name__)


def matches_pattern(filename: str, pattern: str) -> bool:
    """
    Check if a filename matches a glob-style pattern.

    Args:
        filename: File name to check (e.g., "customer_2024.csv")
        pattern: Glob pattern (e.g., "customer_*.csv")

    Returns:
        True if filename matches pattern

    Examples:
        >>> matches_pattern("customer_2024.csv", "customer_*.csv")
        True
        >>> matches_pattern("order_jan.json", "customer_*.csv")
        False
        >>> matches_pattern("sales_Q1_2024.csv", "sales_*_2024.csv")
        True
    """
    # Use Python's fnmatch for Unix-style glob patterns
    return fnmatch.fnmatch(filename, pattern)


def find_matching_files(
    s3_prefix: str,
    file_pattern: str,
    s3_client: S3Client = None
) -> List[Dict[str, Any]]:
    """
    Find all files in S3 that match a glob pattern.

    Args:
        s3_prefix: S3 prefix to search under (e.g., "landing/workflow_123/job_456/")
        file_pattern: Glob pattern (e.g., "customer_*.csv")
        s3_client: Optional S3Client instance (creates new one if None)

    Returns:
        List of matching file objects with keys: 'key', 'size', 'last_modified', 's3_uri'

    Examples:
        Files in landing/workflow_123/job_456/:
        - customer_2024.csv
        - customer_jan.csv
        - orders_2024.csv

        >>> find_matching_files("landing/workflow_123/job_456/", "customer_*.csv")
        [
            {'key': 'landing/workflow_123/job_456/customer_2024.csv', ...},
            {'key': 'landing/workflow_123/job_456/customer_jan.csv', ...}
        ]
    """
    if s3_client is None:
        s3_client = S3Client()

    # List all objects under the prefix
    all_objects = s3_client.list_objects(prefix=s3_prefix)

    # Filter by pattern matching
    matching_files = []
    for obj in all_objects:
        # Extract just the filename from the full S3 key
        filename = Path(obj['key']).name

        if matches_pattern(filename, file_pattern):
            matching_files.append(obj)
            logger.info(f"Pattern match: {filename} matches {file_pattern}")
        else:
            logger.debug(f"Pattern skip: {filename} does not match {file_pattern}")

    logger.info(
        f"Found {len(matching_files)} files matching pattern '{file_pattern}' "
        f"in prefix '{s3_prefix}' (scanned {len(all_objects)} total files)"
    )

    # Sort by last_modified descending (most recent first)
    matching_files.sort(key=lambda x: x['last_modified'], reverse=True)

    return matching_files


if __name__ == "__main__":
    # Example usage for testing
    import sys

    if len(sys.argv) < 3:
        print("Usage: python pattern_matcher.py <s3_prefix> <pattern>")
        print("Example: python pattern_matcher.py landing/workflow_123/job_456/ 'customer_*.csv'")
        sys.exit(1)

    s3_prefix = sys.argv[1]
    pattern = sys.argv[2]

    matches = find_matching_files(s3_prefix, pattern)

    print(f"\nFound {len(matches)} matching files:")
    for match in matches:
        print(f"  - {match['key']} ({match['size']} bytes, modified {match['last_modified']})")
