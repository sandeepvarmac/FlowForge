"""S3/MinIO client utilities for FlowForge."""

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from typing import List, Optional, Dict, Any
from pathlib import Path
import logging

from .config import settings

logger = logging.getLogger(__name__)


class S3Client:
    """S3/MinIO client wrapper with FlowForge-specific utilities."""

    def __init__(self):
        """Initialize S3 client with configuration from settings."""
        self.s3_client = boto3.client(
            's3',
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region,
            config=Config(signature_version='s3v4')
        )
        self.bucket = settings.s3_bucket_name

    def upload_file(
        self,
        local_path: str | Path,
        s3_key: str,
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload a file to S3/MinIO.

        Args:
            local_path: Local file path
            s3_key: S3 object key (path in bucket)
            metadata: Optional metadata to attach

        Returns:
            S3 URI of uploaded file
        """
        try:
            extra_args = {}
            if metadata:
                extra_args['Metadata'] = metadata

            self.s3_client.upload_file(
                str(local_path),
                self.bucket,
                s3_key,
                ExtraArgs=extra_args
            )

            s3_uri = f"s3://{self.bucket}/{s3_key}"
            logger.info(f"Uploaded {local_path} → {s3_uri}")
            return s3_uri

        except ClientError as e:
            logger.error(f"Failed to upload {local_path}: {e}")
            raise

    def download_file(self, s3_key: str, local_path: str | Path) -> Path:
        """Download a file from S3/MinIO.

        Args:
            s3_key: S3 object key
            local_path: Local destination path

        Returns:
            Path to downloaded file
        """
        try:
            local_path = Path(local_path)
            local_path.parent.mkdir(parents=True, exist_ok=True)

            self.s3_client.download_file(
                self.bucket,
                s3_key,
                str(local_path)
            )

            logger.info(f"Downloaded s3://{self.bucket}/{s3_key} → {local_path}")
            return local_path

        except ClientError as e:
            logger.error(f"Failed to download {s3_key}: {e}")
            raise

    def list_objects(
        self,
        prefix: str = "",
        suffix: str = ""
    ) -> List[Dict[str, Any]]:
        """List objects in S3/MinIO bucket with optional prefix/suffix filter.

        Args:
            prefix: Filter objects by prefix (folder path)
            suffix: Filter objects by suffix (file extension)

        Returns:
            List of object metadata dictionaries
        """
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=self.bucket, Prefix=prefix)

            objects = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        if not suffix or obj['Key'].endswith(suffix):
                            objects.append({
                                'key': obj['Key'],
                                'size': obj['Size'],
                                'last_modified': obj['LastModified'],
                                's3_uri': f"s3://{self.bucket}/{obj['Key']}"
                            })

            logger.info(f"Found {len(objects)} objects with prefix='{prefix}', suffix='{suffix}'")
            return objects

        except ClientError as e:
            logger.error(f"Failed to list objects: {e}")
            raise

    def delete_object(self, s3_key: str) -> None:
        """Delete an object from S3/MinIO.

        Args:
            s3_key: S3 object key to delete
        """
        try:
            self.s3_client.delete_object(Bucket=self.bucket, Key=s3_key)
            logger.info(f"Deleted s3://{self.bucket}/{s3_key}")

        except ClientError as e:
            logger.error(f"Failed to delete {s3_key}: {e}")
            raise

    def get_s3_uri(self, layer: str, workflow_id: str, job_id: str, filename: str) -> str:
        """Generate S3 URI following FlowForge conventions.

        Args:
            layer: Data layer (landing, bronze, silver, gold)
            workflow_id: Workflow identifier
            job_id: Job identifier
            filename: File name

        Returns:
            S3 URI string
        """
        s3_key = f"{layer}/{workflow_id}/{job_id}/{filename}"
        return f"s3://{self.bucket}/{s3_key}"

    def object_exists(self, s3_key: str) -> bool:
        """Check if an object exists in S3/MinIO.

        Args:
            s3_key: S3 object key

        Returns:
            True if object exists, False otherwise
        """
        try:
            self.s3_client.head_object(Bucket=self.bucket, Key=s3_key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            raise

    def copy_file(self, source_key: str, dest_key: str) -> str:
        """Copy an object within the same bucket.

        Args:
            source_key: Source S3 object key
            dest_key: Destination S3 object key

        Returns:
            S3 URI of copied file
        """
        try:
            copy_source = {'Bucket': self.bucket, 'Key': source_key}
            self.s3_client.copy_object(
                CopySource=copy_source,
                Bucket=self.bucket,
                Key=dest_key
            )

            s3_uri = f"s3://{self.bucket}/{dest_key}"
            logger.info(f"Copied s3://{self.bucket}/{source_key} -> {s3_uri}")
            return s3_uri

        except ClientError as e:
            logger.error(f"Failed to copy {source_key} to {dest_key}: {e}")
            raise

    def delete_file(self, s3_key: str) -> None:
        """Delete an object from S3/MinIO (alias for delete_object).

        Args:
            s3_key: S3 object key to delete
        """
        self.delete_object(s3_key)
