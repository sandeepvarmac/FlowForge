"""Utility functions for generating human-readable slugs from names."""

import re
from typing import Optional


def slugify(text: str) -> str:
    """
    Convert text to lowercase, hyphenated slug.

    Examples:
        "Customer Data Pipeline" -> "customer-data-pipeline"
        "Ingest Countries" -> "ingest-countries"
        "Load_Orders_2024" -> "load-orders-2024"
    """
    # Convert to lowercase
    slug = text.lower()

    # Replace underscores and spaces with hyphens
    slug = re.sub(r'[_\s]+', '-', slug)

    # Remove any characters that aren't alphanumeric or hyphens
    slug = re.sub(r'[^a-z0-9-]', '', slug)

    # Remove multiple consecutive hyphens
    slug = re.sub(r'-+', '-', slug)

    # Strip leading/trailing hyphens
    slug = slug.strip('-')

    return slug


def generate_run_id(flow_run_id: Optional[str] = None) -> str:
    """
    Generate a short run identifier.

    If Prefect flow_run_id is provided, use the first 8 characters (UUID prefix).
    Otherwise, generate timestamp + random suffix.

    Examples:
        "cfee487b-5e77-4abf-b7cd-b3214fbda3e5" -> "cfee487b"
        None -> "20251006-a3b4c5d6"
    """
    if flow_run_id:
        # Use first 8 chars of UUID (before first hyphen)
        return flow_run_id.split('-')[0]

    # Fallback: timestamp + random
    from datetime import datetime
    import random
    import string

    timestamp = datetime.utcnow().strftime('%Y%m%d')
    random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"{timestamp}-{random_suffix}"
