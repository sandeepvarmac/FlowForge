"""Create Prefect deployment with S3 storage using prefect-aws"""
import os
os.environ['PREFECT_API_URL'] = 'http://localhost:4200/api'

from prefect import flow
from prefect.runner.storage import GitRepository
from prefect.blocks.system import Secret
from prefect_aws.s3 import S3Bucket

# Create wrapper flow to avoid circular import
@flow(name="flowforge-medallion")
def medallion_pipeline_wrapper(**kwargs):
    """Wrapper flow that imports and calls the real medallion pipeline"""
    from flows.medallion import medallion_pipeline as real_flow
    return real_flow(**kwargs)

# Check if S3Bucket block exists, create if not
try:
    storage = S3Bucket.load("flowforge-s3-storage")
    print("S3Bucket block already exists")
except:
    print("Creating S3Bucket storage block...")
    storage = S3Bucket(
        bucket_name="flowforge-code",
        bucket_folder="prefect-flows",
        aws_access_key_id="minioadmin",
        aws_secret_access_key="minioadmin123",
        endpoint_url="http://localhost:9000",
    )
    storage.save("flowforge-s3-storage", overwrite=True)
    print("S3Bucket block created")

# Create deployment using modern flow.deploy() method
print("\nCreating deployment with S3 storage...")

try:
    # Use from_source method with S3Bucket
    deployment_id = medallion_pipeline_wrapper.from_source(
        source=storage.get_directory("."),
        entrypoint="flows/medallion.py:medallion_pipeline",
    ).deploy(
        name="s3-production",
        work_pool_name="flowforge-development",
        work_queue_name="default",
        parameters={},
        tags=["s3", "production"]
    )

    print(f"\nDeployment created successfully!")
    print(f"Deployment ID: {deployment_id}")
    print(f"Storage: S3 MinIO (s3://flowforge-code/prefect-flows)")
    print(f"\nNext steps:")
    print(f"1. Worker should auto-detect the deployment")
    print(f"2. Update job config with deployment ID: {deployment_id}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
