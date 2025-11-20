"""Create a simple Prefect deployment for FlowForge"""
import os
os.environ['PREFECT_API_URL'] = 'http://localhost:4200/api'

from prefect import flow
from prefect.deployments import Deployment

# Import just the flow function to avoid circular imports
import sys
from pathlib import Path
PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

# Read the flow directly without importing dependencies
@flow(name="flowforge-medallion")
def medallion_pipeline_wrapper(**kwargs):
    """Wrapper flow that imports and calls the real medallion pipeline"""
    from flows.medallion import medallion_pipeline as real_flow
    return real_flow(**kwargs)

# Create deployment
print("Creating Prefect deployment...")
deployment = Deployment.build_from_flow(
    flow=medallion_pipeline_wrapper,
    name="local-development",
    work_pool_name="flowforge-development",
)

deployment_id = deployment.apply()
print(f"\n✅ Deployment created successfully!")
print(f"📋 Deployment ID: {deployment_id}")
print(f"\nNext steps:")
print(f"1. Start a worker: prefect worker start --pool default-agent-pool")
print(f"2. Update apps/web/.env.local with: PREFECT_DEPLOYMENT_ID={deployment_id}")
