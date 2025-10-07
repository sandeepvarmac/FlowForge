"""Upload sample data files to MinIO landing bucket."""

import sys
from pathlib import Path
import boto3

# Add parent to path for utils
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from utils.config import settings

# Sample data mapping: workflow_id -> job_id -> filename
WORKFLOW_FILES = {
    "demo-snowflake-001": {
        "job-countries-001": "countries.csv",
        "job-customers-001": "Customers.csv",
        "job-products-001": "products.csv",
        "job-orders-001": "orders.csv",
    }
}

def upload_sample_data():
    """Upload all sample CSV files to MinIO landing paths."""
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )

    sample_data_dir = PROJECT_ROOT.parent / "sample-data"

    for workflow_id, jobs in WORKFLOW_FILES.items():
        for job_id, filename in jobs.items():
            local_file = sample_data_dir / filename
            if not local_file.exists():
                print(f"[SKIP] File not found: {local_file}")
                continue

            s3_key = f"landing/{workflow_id}/{job_id}/{filename}"

            try:
                s3.upload_file(
                    str(local_file),
                    settings.s3_bucket_name,
                    s3_key
                )
                print(f"[OK] Uploaded {filename} -> s3://{settings.s3_bucket_name}/{s3_key}")
            except Exception as e:
                print(f"[ERROR] Failed to upload {filename}: {e}")

if __name__ == "__main__":
    upload_sample_data()
