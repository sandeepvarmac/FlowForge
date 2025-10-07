"""Check MinIO S3 connection and list objects."""

import sys
from pathlib import Path
import boto3

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from utils.config import settings

s3 = boto3.client(
    "s3",
    endpoint_url=settings.s3_endpoint_url,
    aws_access_key_id=settings.s3_access_key_id,
    aws_secret_access_key=settings.s3_secret_access_key,
)

print(f"Connecting to: {settings.s3_endpoint_url}")
print(f"Bucket: {settings.s3_bucket_name}\n")

try:
    response = s3.list_objects_v2(Bucket=settings.s3_bucket_name, Prefix="landing/")

    if 'Contents' in response:
        print(f"Found {len(response['Contents'])} objects in landing/:")
        for obj in response['Contents']:
            print(f"  - {obj['Key']} ({obj['Size']} bytes)")
    else:
        print("No objects found in landing/ folder")
except Exception as e:
    print(f"ERROR: {e}")
