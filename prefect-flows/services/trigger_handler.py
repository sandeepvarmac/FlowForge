"""
Trigger Handler for FlowForge Dependency-Based Triggers

This service handles execution completion notifications and triggers
dependent workflows based on configured dependency triggers.
"""

import os
import asyncio
from typing import Dict, Any, Optional
import httpx
from datetime import datetime, timedelta


class TriggerHandler:
    """
    Handles workflow execution completions and triggers dependent workflows.
    """

    def __init__(self, api_base_url: Optional[str] = None):
        """
        Initialize trigger handler.

        Args:
            api_base_url: Base URL for FlowForge API (default: from env or localhost)
        """
        self.api_base_url = api_base_url or os.getenv(
            'FLOWFORGE_API_URL',
            'http://localhost:3000'
        )

    async def notify_execution_complete(
        self,
        execution_id: str,
        workflow_id: str,
        status: str
    ) -> Dict[str, Any]:
        """
        Notify the system that an execution has completed.

        This triggers any dependency-based workflows that are waiting for
        this workflow to complete.

        Args:
            execution_id: Unique execution ID
            workflow_id: Workflow that completed
            status: 'completed' or 'failed'

        Returns:
            Dictionary with trigger results

        Example:
            >>> handler = TriggerHandler()
            >>> result = await handler.notify_execution_complete(
            ...     'exec_123',
            ...     'wf_abc',
            ...     'completed'
            ... )
            >>> print(result['triggeredCount'])
            2
        """
        if status not in ['completed', 'failed']:
            raise ValueError(f"Invalid status: {status}. Must be 'completed' or 'failed'")

        url = f"{self.api_base_url}/api/executions/{execution_id}/complete"

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    url,
                    json={
                        'status': status,
                        'workflowId': workflow_id
                    }
                )

                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            print(f"HTTP error notifying execution complete: {e}")
            raise
        except Exception as e:
            print(f"Error notifying execution complete: {e}")
            raise

    def notify_execution_complete_sync(
        self,
        execution_id: str,
        workflow_id: str,
        status: str
    ) -> Dict[str, Any]:
        """
        Synchronous version of notify_execution_complete.

        Use this from Prefect flows that are not async.
        """
        return asyncio.run(
            self.notify_execution_complete(execution_id, workflow_id, status)
        )

    async def trigger_workflow_manually(
        self,
        workflow_id: str,
        trigger_id: str,
        triggered_by: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Manually trigger a workflow execution.

        Args:
            workflow_id: Workflow to trigger
            trigger_id: Trigger that initiated this execution
            triggered_by: Optional metadata about what triggered this

        Returns:
            Execution details
        """
        url = f"{self.api_base_url}/api/workflows/{workflow_id}/execute"

        execution_id = f"exec_{int(datetime.now().timestamp())}_{workflow_id[:8]}"

        payload = {
            'executionId': execution_id,
            'triggerId': trigger_id,
            'triggeredBy': triggered_by or {}
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, json=payload)
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            print(f"HTTP error triggering workflow: {e}")
            raise
        except Exception as e:
            print(f"Error triggering workflow: {e}")
            raise

    async def schedule_delayed_trigger(
        self,
        workflow_id: str,
        trigger_id: str,
        delay_minutes: int,
        triggered_by: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Schedule a workflow to be triggered after a delay.

        Note: This is a placeholder implementation. In production, this would
        use a job queue (like Celery, Bull, or Prefect's own scheduling).

        Args:
            workflow_id: Workflow to trigger
            trigger_id: Trigger that initiated this
            delay_minutes: Minutes to wait before triggering
            triggered_by: Metadata about what triggered this

        Returns:
            Scheduling details
        """
        print(
            f"Scheduling workflow {workflow_id} to trigger in {delay_minutes} minutes"
        )

        # TODO: Implement with proper job queue
        # For now, just sleep and trigger (not production-ready)
        if delay_minutes > 0:
            await asyncio.sleep(delay_minutes * 60)

        return await self.trigger_workflow_manually(
            workflow_id,
            trigger_id,
            triggered_by
        )

    async def get_dependent_workflows(
        self,
        workflow_id: str
    ) -> Dict[str, Any]:
        """
        Get all workflows that depend on the given workflow.

        Args:
            workflow_id: Workflow to check dependencies for

        Returns:
            Dictionary with dependent workflows
        """
        url = f"{self.api_base_url}/api/workflows/{workflow_id}/triggers/dependencies"

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                return response.json()

        except httpx.HTTPError as e:
            print(f"HTTP error getting dependent workflows: {e}")
            raise
        except Exception as e:
            print(f"Error getting dependent workflows: {e}")
            raise


# Convenience function for use in Prefect flows
def notify_completion(
    execution_id: str,
    workflow_id: str,
    status: str,
    api_base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Convenience function to notify execution completion.

    Use this at the end of Prefect flows to trigger dependent workflows.

    Args:
        execution_id: Execution ID
        workflow_id: Workflow ID
        status: 'completed' or 'failed'
        api_base_url: Optional API base URL

    Returns:
        Trigger results

    Example:
        >>> from services.trigger_handler import notify_completion
        >>> result = notify_completion('exec_123', 'wf_abc', 'completed')
        >>> print(f"Triggered {result['triggeredCount']} dependent workflows")
    """
    handler = TriggerHandler(api_base_url)
    return handler.notify_execution_complete_sync(execution_id, workflow_id, status)
