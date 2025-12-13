"""
File Processing Tracking Utilities for FlowForge

This module provides functions for:
- Tracking file processing status in the database
- Archiving processed files from landing zone
- Managing watermarks for incremental loads
"""

from datetime import datetime
from pathlib import Path
import hashlib
import os
import requests
from typing import Optional


def archive_landing_file(s3_client, landing_key: str, logger) -> Optional[str]:
    """
    Move processed file from landing zone to archive folder.

    Pattern: landing/{workflow}/{job}/file.csv -> landing/{workflow}/{job}/archive/{date}/file.csv

    Args:
        s3_client: S3Client instance
        landing_key: Original landing zone key
        logger: Prefect logger

    Returns:
        Archive key if successful, None if failed
    """
    try:
        # Build archive key
        path_parts = landing_key.split('/')
        # landing/{workflow}/{job}/file.csv -> landing/{workflow}/{job}/archive/{date}/file.csv
        if len(path_parts) >= 4:
            date_folder = datetime.utcnow().strftime("%Y%m%d")
            filename = path_parts[-1]
            base_path = '/'.join(path_parts[:-1])
            archive_key = f"{base_path}/archive/{date_folder}/{filename}"
        else:
            # Fallback for simpler paths
            archive_key = landing_key.replace('landing/', 'landing/archive/')

        # Copy to archive location
        s3_client.copy_file(landing_key, archive_key)
        logger.info(f"Copied to archive: {archive_key}")

        # Delete original from landing zone
        s3_client.delete_file(landing_key)
        logger.info(f"Deleted from landing: {landing_key}")

        return archive_key

    except Exception as e:
        logger.warning(f"Failed to archive landing file: {e}")
        return None


def log_file_processing(
    source_id: str,
    execution_id: Optional[str],
    landing_key: str,
    file_hash: Optional[str],
    file_size: int,
    status: str,
    records_processed: int,
    bronze_key: Optional[str],
    archive_key: Optional[str],
    error_message: Optional[str],
    logger
) -> bool:
    """
    Log file processing status to FlowForge database via API.

    Args:
        source_id: Source/Job ID
        execution_id: Pipeline execution ID (optional)
        landing_key: Original landing zone path
        file_hash: MD5 hash of file for deduplication
        file_size: File size in bytes
        status: Processing status (pending, processing, completed, failed, archived)
        records_processed: Number of records processed
        bronze_key: Resulting bronze file path
        archive_key: Archive location after processing
        error_message: Error message if failed
        logger: Prefect logger

    Returns:
        True if logged successfully
    """
    try:
        api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
        api_url = f"{api_base_url}/api/files/processing-log"

        filename = Path(landing_key).name
        now = datetime.utcnow().isoformat()

        payload = {
            "source_id": source_id,
            "execution_id": execution_id,
            "file_name": filename,
            "landing_key": landing_key,
            "file_hash": file_hash,
            "file_size": file_size,
            "status": status,
            "records_processed": records_processed,
            "bronze_key": bronze_key,
            "archive_key": archive_key,
            "error_message": error_message,
            "archived_at": now if status == "archived" else None,
        }

        response = requests.post(api_url, json=payload, timeout=10)
        if response.status_code in (200, 201):
            logger.info(f"File processing logged: {filename} -> {status}")
            return True
        else:
            logger.warning(f"Failed to log file processing: {response.status_code}")
            return False

    except Exception as e:
        logger.warning(f"Error logging file processing: {e}")
        return False


def calculate_file_hash(file_path: Path) -> str:
    """Calculate MD5 hash of a file for deduplication."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def update_watermark(
    source_id: str,
    watermark_column: str,
    watermark_type: str,
    new_value: str,
    rows_processed: int,
    logger
) -> bool:
    """
    Update watermark value for incremental load tracking.

    Args:
        source_id: Source/Job ID
        watermark_column: Column used for watermark (e.g., updated_at)
        watermark_type: Type of watermark (timestamp, integer, date)
        new_value: New watermark value after processing
        rows_processed: Number of rows processed in this run
        logger: Prefect logger

    Returns:
        True if updated successfully
    """
    try:
        api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
        api_url = f"{api_base_url}/api/sources/{source_id}/watermark"

        payload = {
            "watermark_column": watermark_column,
            "watermark_type": watermark_type,
            "new_value": new_value,
            "rows_processed": rows_processed,
        }

        response = requests.put(api_url, json=payload, timeout=10)
        if response.status_code in (200, 201):
            logger.info(f"Watermark updated: {watermark_column} = {new_value}")
            return True
        else:
            logger.warning(f"Failed to update watermark: {response.status_code}")
            return False

    except Exception as e:
        logger.warning(f"Error updating watermark: {e}")
        return False


def get_watermark(source_id: str, logger) -> Optional[dict]:
    """
    Get current watermark value for a source.

    Args:
        source_id: Source/Job ID
        logger: Prefect logger

    Returns:
        Dict with watermark info or None if not found
    """
    try:
        api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
        api_url = f"{api_base_url}/api/sources/{source_id}/watermark"

        response = requests.get(api_url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            logger.info(f"Got watermark: {data.get('watermark_column')} = {data.get('current_value')}")
            return data
        else:
            logger.info(f"No watermark found for source {source_id}")
            return None

    except Exception as e:
        logger.warning(f"Error getting watermark: {e}")
        return None


def check_file_already_processed(source_id: str, file_hash: str, logger) -> bool:
    """
    Check if a file with the same hash has already been processed.

    Args:
        source_id: Source/Job ID
        file_hash: MD5 hash of the file
        logger: Prefect logger

    Returns:
        True if file was already processed (duplicate)
    """
    try:
        api_base_url = os.getenv("FLOWFORGE_API_URL", "http://localhost:3000")
        api_url = f"{api_base_url}/api/files/check-duplicate"

        payload = {
            "source_id": source_id,
            "file_hash": file_hash,
        }

        response = requests.post(api_url, json=payload, timeout=10)
        if response.status_code == 200:
            data = response.json()
            is_duplicate = data.get("is_duplicate", False)
            if is_duplicate:
                logger.warning(f"Duplicate file detected (hash: {file_hash[:8]}...)")
            return is_duplicate
        else:
            return False

    except Exception as e:
        logger.warning(f"Error checking duplicate: {e}")
        return False
