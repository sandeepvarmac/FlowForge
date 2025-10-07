"""Create Prefect deployment for FlowForge medallion pipeline."""

from prefect import flow
from prefect.deployments import Deployment
from prefect.server.schemas.schedules import CronSchedule
from flows.medallion import medallion_pipeline

def create_deployment():
    """Create the customer-data deployment."""
    deployment = Deployment.build_from_flow(
        flow=medallion_pipeline,
        name="customer-data",
        work_pool_name="flowforge-local",
        work_queue_name="default",
        parameters={
            "workflow_id": "placeholder",
            "job_id": "placeholder",
            "landing_key": "placeholder",
        },
    )
    deployment.apply()
    print("[OK] Deployment 'flowforge-medallion/customer-data' created successfully")

if __name__ == "__main__":
    create_deployment()
