"""Clean all files from MinIO buckets, leaving only empty folders."""

import sys
from pathlib import Path
import boto3

PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from utils.config import settings

def clean_all_buckets():
    """Remove all objects from MinIO, leaving empty folder structure."""
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
    )

    # List and delete all objects
    try:
        response = s3.list_objects_v2(Bucket=settings.s3_bucket_name)

        if 'Contents' in response:
            objects_to_delete = [{'Key': obj['Key']} for obj in response['Contents']]

            if objects_to_delete:
                s3.delete_objects(
                    Bucket=settings.s3_bucket_name,
                    Delete={'Objects': objects_to_delete}
                )
                print(f"[OK] Deleted {len(objects_to_delete)} objects from {settings.s3_bucket_name}")
            else:
                print("[OK] Bucket already empty")
        else:
            print("[OK] Bucket already empty")

        # Recreate empty folder structure
        for folder in ['landing/', 'bronze/', 'silver/', 'gold/']:
            s3.put_object(Bucket=settings.s3_bucket_name, Key=folder, Body=b'')
            print(f"[OK] Created empty folder: {folder}")

    except Exception as e:
        print(f"[ERROR] Failed to clean bucket: {e}")

if __name__ == "__main__":
    clean_all_buckets()
