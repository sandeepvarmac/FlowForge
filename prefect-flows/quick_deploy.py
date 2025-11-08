"""Quick deployment creation script for FlowForge."""

import os
import sys
from pathlib import Path

# Set Prefect API URL
os.environ["PREFECT_API_URL"] = "http://localhost:4200/api"

from prefect import flow
from prefect.deployments import Deployment

@flow(name="flowforge-medallion", log_prints=True)
def medallion_pipeline(
    workflow_id: str,
    job_id: str,
    workflow_name: str = "workflow",
    job_name: str = "job",
    landing_key: str = "",
    primary_keys: list = None,
    column_mappings: list = None,
    has_header: bool = True,
    flow_run_id: str = None,
    file_format: str = "csv",
    file_options: dict = None,
    execution_id: str = None,
):
    """Medallion pipeline flow."""
    print(f"Medallion pipeline: {workflow_id}/{job_id}")
    print(f"Landing key: {landing_key}")
    return {"status": "completed"}

# Create deployment
print("Creating deployment...")
deployment = Deployment.build_from_flow(
    flow=medallion_pipeline,
    name="customer-data",
    parameters={
        "workflow_id": "placeholder",
        "job_id": "placeholder",
        "landing_key": "placeholder",
    },
)

deployment_id = deployment.apply()
print(f"\n✅ Deployment created successfully!")
print(f"📋 Deployment ID: {deployment_id}")
print(f"\n⚠️  IMPORTANT: Copy this deployment ID to apps/web/.env.local:")
print(f"   PREFECT_DEPLOYMENT_ID={deployment_id}")
