"""
Prefect Deployment Manager for FlowForge scheduled triggers.

Manages Prefect deployments for scheduled workflow execution.
Handles creation, updates, and deletion of deployments based on workflow triggers.
"""

import os
import sys
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from prefect import get_client
from prefect.client.schemas.schedules import CronSchedule
from prefect.deployments import Deployment
from flows.medallion import medallion_pipeline
from utils.cron_utils import validate_cron_expression, get_next_run_timestamp


class DeploymentManager:
    """
    Manages Prefect deployments for FlowForge workflow triggers.

    Each scheduled trigger gets its own Prefect deployment with a CronSchedule.
    Deployment names follow the pattern: "flowforge-trigger-{trigger_id}"
    """

    @staticmethod
    def _get_deployment_name(trigger_id: str) -> str:
        """Generate deployment name from trigger ID."""
        return f"flowforge-trigger-{trigger_id}"

    @staticmethod
    def _validate_trigger_config(
        trigger_id: str,
        workflow_id: str,
        workflow_name: str,
        cron_expression: str,
        timezone: str
    ) -> tuple[bool, Optional[str]]:
        """
        Validate trigger configuration before creating deployment.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not trigger_id:
            return False, "trigger_id is required"

        if not workflow_id:
            return False, "workflow_id is required"

        if not workflow_name:
            return False, "workflow_name is required"

        # Validate cron expression
        is_valid, error_msg = validate_cron_expression(cron_expression)
        if not is_valid:
            return False, f"Invalid cron expression: {error_msg}"

        if not timezone:
            return False, "timezone is required"

        return True, None

    @staticmethod
    async def create_scheduled_deployment(
        trigger_id: str,
        workflow_id: str,
        workflow_name: str,
        cron_expression: str,
        timezone: str = "UTC",
        trigger_name: Optional[str] = None,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a Prefect deployment for a scheduled trigger.

        Args:
            trigger_id: Unique trigger ID from workflow_triggers table
            workflow_id: Workflow ID to execute
            workflow_name: Human-readable workflow name
            cron_expression: Cron expression (5 fields)
            timezone: Timezone for schedule (default: UTC)
            trigger_name: Optional human-readable trigger name
            additional_params: Additional parameters to pass to the flow

        Returns:
            Dictionary with deployment details

        Raises:
            ValueError: If configuration is invalid
            Exception: If deployment creation fails

        Example:
            >>> result = await create_scheduled_deployment(
            ...     trigger_id="trig_abc123",
            ...     workflow_id="wf_xyz789",
            ...     workflow_name="Daily Sales Report",
            ...     cron_expression="0 2 * * *",
            ...     timezone="America/New_York"
            ... )
        """
        # Validate configuration
        is_valid, error_msg = DeploymentManager._validate_trigger_config(
            trigger_id, workflow_id, workflow_name, cron_expression, timezone
        )
        if not is_valid:
            raise ValueError(error_msg)

        deployment_name = DeploymentManager._get_deployment_name(trigger_id)

        # Create CronSchedule
        schedule = CronSchedule(cron=cron_expression, timezone=timezone)

        # Build deployment description
        description = trigger_name or f"Scheduled execution for {workflow_name}"

        # Build flow parameters
        # Note: These will need to be provided when the trigger creates an execution
        # For now, we'll use placeholder values that will be replaced at runtime
        flow_params = {
            "workflow_id": workflow_id,
            "job_id": f"scheduled-{trigger_id}",  # Placeholder, will be replaced
            "workflow_name": workflow_name,
            "job_name": "Scheduled Execution",
            "landing_key": "",  # Will be set at runtime
        }

        if additional_params:
            flow_params.update(additional_params)

        try:
            # Create deployment using Prefect's Deployment class
            deployment = await Deployment.build_from_flow(
                flow=medallion_pipeline,
                name=deployment_name,
                description=description,
                schedule=schedule,
                parameters=flow_params,
                work_queue_name="default",
                tags=["flowforge", "scheduled", f"workflow:{workflow_id}", f"trigger:{trigger_id}"],
            )

            # Apply the deployment
            deployment_id = await deployment.apply()

            # Calculate next run time
            next_run_timestamp = get_next_run_timestamp(cron_expression, timezone)

            return {
                "success": True,
                "deployment_id": str(deployment_id),
                "deployment_name": deployment_name,
                "trigger_id": trigger_id,
                "workflow_id": workflow_id,
                "cron_expression": cron_expression,
                "timezone": timezone,
                "next_run_timestamp": next_run_timestamp,
                "message": f"Deployment '{deployment_name}' created successfully"
            }

        except Exception as e:
            raise Exception(f"Failed to create deployment: {str(e)}")

    @staticmethod
    async def update_scheduled_deployment(
        trigger_id: str,
        workflow_id: str,
        workflow_name: str,
        cron_expression: str,
        timezone: str = "UTC",
        trigger_name: Optional[str] = None,
        additional_params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Update an existing scheduled deployment.

        Prefect doesn't support direct updates, so this deletes and recreates the deployment.

        Args:
            trigger_id: Trigger ID
            workflow_id: Workflow ID
            workflow_name: Workflow name
            cron_expression: New cron expression
            timezone: New timezone
            trigger_name: Optional trigger name
            additional_params: Additional parameters

        Returns:
            Dictionary with update details
        """
        try:
            # Delete existing deployment
            await DeploymentManager.delete_scheduled_deployment(trigger_id)

            # Create new deployment with updated configuration
            result = await DeploymentManager.create_scheduled_deployment(
                trigger_id=trigger_id,
                workflow_id=workflow_id,
                workflow_name=workflow_name,
                cron_expression=cron_expression,
                timezone=timezone,
                trigger_name=trigger_name,
                additional_params=additional_params
            )

            result["message"] = f"Deployment updated successfully"
            return result

        except Exception as e:
            raise Exception(f"Failed to update deployment: {str(e)}")

    @staticmethod
    async def delete_scheduled_deployment(trigger_id: str) -> Dict[str, Any]:
        """
        Delete a scheduled deployment.

        Args:
            trigger_id: Trigger ID

        Returns:
            Dictionary with deletion details
        """
        deployment_name = DeploymentManager._get_deployment_name(trigger_id)

        try:
            async with get_client() as client:
                # Find deployment by name
                deployments = await client.read_deployments(
                    deployment_filter={"name": {"like_": deployment_name}}
                )

                if not deployments:
                    return {
                        "success": True,
                        "message": f"Deployment '{deployment_name}' not found (may already be deleted)",
                        "deployment_name": deployment_name,
                        "trigger_id": trigger_id
                    }

                # Delete the deployment
                deployment_id = deployments[0].id
                await client.delete_deployment(deployment_id)

                return {
                    "success": True,
                    "deployment_id": str(deployment_id),
                    "deployment_name": deployment_name,
                    "trigger_id": trigger_id,
                    "message": f"Deployment '{deployment_name}' deleted successfully"
                }

        except Exception as e:
            raise Exception(f"Failed to delete deployment: {str(e)}")

    @staticmethod
    async def pause_scheduled_deployment(trigger_id: str) -> Dict[str, Any]:
        """
        Pause a scheduled deployment (sets schedule to inactive).

        Args:
            trigger_id: Trigger ID

        Returns:
            Dictionary with pause details
        """
        deployment_name = DeploymentManager._get_deployment_name(trigger_id)

        try:
            async with get_client() as client:
                # Find deployment by name
                deployments = await client.read_deployments(
                    deployment_filter={"name": {"like_": deployment_name}}
                )

                if not deployments:
                    raise ValueError(f"Deployment '{deployment_name}' not found")

                deployment = deployments[0]

                # Set schedule to inactive
                await client.update_deployment(
                    deployment.id,
                    is_schedule_active=False
                )

                return {
                    "success": True,
                    "deployment_id": str(deployment.id),
                    "deployment_name": deployment_name,
                    "trigger_id": trigger_id,
                    "message": f"Deployment '{deployment_name}' paused successfully"
                }

        except Exception as e:
            raise Exception(f"Failed to pause deployment: {str(e)}")

    @staticmethod
    async def resume_scheduled_deployment(trigger_id: str) -> Dict[str, Any]:
        """
        Resume a paused scheduled deployment (sets schedule to active).

        Args:
            trigger_id: Trigger ID

        Returns:
            Dictionary with resume details
        """
        deployment_name = DeploymentManager._get_deployment_name(trigger_id)

        try:
            async with get_client() as client:
                # Find deployment by name
                deployments = await client.read_deployments(
                    deployment_filter={"name": {"like_": deployment_name}}
                )

                if not deployments:
                    raise ValueError(f"Deployment '{deployment_name}' not found")

                deployment = deployments[0]

                # Set schedule to active
                await client.update_deployment(
                    deployment.id,
                    is_schedule_active=True
                )

                return {
                    "success": True,
                    "deployment_id": str(deployment.id),
                    "deployment_name": deployment_name,
                    "trigger_id": trigger_id,
                    "message": f"Deployment '{deployment_name}' resumed successfully"
                }

        except Exception as e:
            raise Exception(f"Failed to resume deployment: {str(e)}")

    @staticmethod
    async def get_deployment_info(trigger_id: str) -> Dict[str, Any]:
        """
        Get information about a scheduled deployment.

        Args:
            trigger_id: Trigger ID

        Returns:
            Dictionary with deployment details
        """
        deployment_name = DeploymentManager._get_deployment_name(trigger_id)

        try:
            async with get_client() as client:
                # Find deployment by name
                deployments = await client.read_deployments(
                    deployment_filter={"name": {"like_": deployment_name}}
                )

                if not deployments:
                    return {
                        "exists": False,
                        "deployment_name": deployment_name,
                        "trigger_id": trigger_id
                    }

                deployment = deployments[0]

                return {
                    "exists": True,
                    "deployment_id": str(deployment.id),
                    "deployment_name": deployment.name,
                    "trigger_id": trigger_id,
                    "schedule_active": deployment.is_schedule_active,
                    "schedule": str(deployment.schedule) if deployment.schedule else None,
                    "parameters": deployment.parameters,
                    "tags": deployment.tags,
                    "created": deployment.created.isoformat() if deployment.created else None,
                    "updated": deployment.updated.isoformat() if deployment.updated else None,
                }

        except Exception as e:
            raise Exception(f"Failed to get deployment info: {str(e)}")
