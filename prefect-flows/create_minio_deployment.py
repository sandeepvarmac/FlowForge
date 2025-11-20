"""Create Prefect deployment with MinIO storage using API"""
import os
import requests
import uuid

PREFECT_API_URL = 'http://localhost:4200/api'

# Step 1: Create RemoteFileSystem storage block
print("Step 1: Creating RemoteFileSystem storage block...")

storage_block_data = {
    "name": "flowforge-minio-storage",
    "data": {
        "basepath": "s3://flowforge-code/prefect-flows",
        "settings": {
            "key": "minioadmin",
            "secret": "minioadmin123",
            "client_kwargs": {
                "endpoint_url": "http://localhost:9000",
                "region_name": "us-east-1"
            }
        }
    }
}

# Get RemoteFileSystem block type
block_types_resp = requests.post(
    f"{PREFECT_API_URL}/block_types/filter",
    json={"block_types": {"slug": {"any_": ["remote-file-system"]}}}
)
block_types = block_types_resp.json()
if not block_types:
    print("ERROR: RemoteFileSystem block type not found")
    exit(1)

block_type_id = block_types[0]["id"]
print(f"Found RemoteFileSystem block type: {block_type_id}")

# Get block schema
schemas_resp = requests.post(
    f"{PREFECT_API_URL}/block_schemas/filter",
    json={"block_schemas": {"block_type_id": {"any_": [block_type_id]}}}
)
schemas = schemas_resp.json()
if not schemas:
    print("ERROR: Block schema not found")
    exit(1)

block_schema_id = schemas[0]["id"]
print(f"Block schema ID: {block_schema_id}")

# Create or update block
block_resp = requests.post(
    f"{PREFECT_API_URL}/block_documents/",
    json={
        "name": "flowforge-minio-storage",
        "block_type_id": block_type_id,
        "block_schema_id": block_schema_id,
        "data": storage_block_data["data"]
    }
)

if block_resp.status_code in [200, 201]:
    storage_block_id = block_resp.json()["id"]
    print(f"Storage block created: {storage_block_id}")
elif block_resp.status_code == 409:
    # Block exists, get its ID
    blocks_resp = requests.post(
        f"{PREFECT_API_URL}/block_documents/filter",
        json={"block_documents": {"name": {"any_": ["flowforge-minio-storage"]}}}
    )
    storage_block_id = blocks_resp.json()[0]["id"]
    print(f"Storage block already exists: {storage_block_id}")
else:
    print(f"Failed to create storage block: {block_resp.status_code} - {block_resp.text}")
    exit(1)

# Step 2: Get flow ID (we need the existing flow)
print("\nStep 2: Finding flow...")
flows_resp = requests.post(
    f"{PREFECT_API_URL}/flows/filter",
    json={"flows": {"name": {"any_": ["flowforge-medallion"]}}}
)
flows = flows_resp.json()
if not flows:
    print("ERROR: Flow 'flowforge-medallion' not found")
    exit(1)

flow_id = flows[0]["id"]
print(f"Found flow: {flow_id}")

# Step 3: Get work pool ID
print("\nStep 3: Finding work pool...")
work_pools_resp = requests.post(
    f"{PREFECT_API_URL}/work_pools/filter",
    json={"work_pools": {"name": {"any_": ["flowforge-development"]}}}
)
work_pools = work_pools_resp.json()
if not work_pools:
    print("ERROR: Work pool 'flowforge-development' not found")
    exit(1)

work_pool_id = work_pools[0]["id"]
print(f"Found work pool: {work_pool_id}")

# Step 4: Create deployment
print("\nStep 4: Creating deployment...")
deployment_data = {
    "name": "minio-production",
    "flow_id": flow_id,
    "work_pool_name": "flowforge-development",
    "work_queue_name": "default",
    "path": ".",
    "entrypoint": "flows/medallion.py:medallion_pipeline",
    "storage_document_id": storage_block_id,
    "paused": False,
    "is_schedule_active": True,
    "parameters": {},
    "tags": ["minio", "production"]
}

deployment_resp = requests.post(
    f"{PREFECT_API_URL}/deployments/",
    json=deployment_data
)

if deployment_resp.status_code in [200, 201]:
    deployment_id = deployment_resp.json()["id"]
    print(f"\nDeployment created successfully!")
    print(f"Deployment ID: {deployment_id}")
    print(f"Storage: MinIO (s3://flowforge-code/prefect-flows)")
    print(f"\nNext steps:")
    print(f"1. Start worker: prefect worker start --pool flowforge-development")
    print(f"2. Update job config with deployment ID: {deployment_id}")
else:
    print(f"Failed to create deployment: {deployment_resp.status_code}")
    print(deployment_resp.text)
