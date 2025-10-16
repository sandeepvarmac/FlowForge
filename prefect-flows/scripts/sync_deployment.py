#!/usr/bin/env python3
"""
Standalone script to manage Prefect deployments.

This script can be invoked from Node.js to sync triggers with Prefect deployments.

Usage:
  Sync deployment:  python sync_deployment.py sync <trigger_id> <workflow_id> <workflow_name> <cron> <timezone> <trigger_name> <enabled>
  Delete deployment: python sync_deployment.py delete <trigger_id>
  Get info:         python sync_deployment.py info <trigger_id>
"""

import sys
import json
import asyncio
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.deployment_manager import DeploymentManager


async def sync_deployment(args):
    """Sync (create or update) a deployment."""
    if len(args) < 8:
        return {
            "success": False,
            "error": "Usage: sync <trigger_id> <workflow_id> <workflow_name> <cron> <timezone> <trigger_name> <enabled>"
        }

    trigger_id = args[1]
    workflow_id = args[2]
    workflow_name = args[3]
    cron_expression = args[4]
    timezone = args[5]
    trigger_name = args[6] if args[6] else None
    enabled = args[7] == '1' if len(args) > 7 else True

    try:
        # Check if deployment exists
        info = await DeploymentManager.get_deployment_info(trigger_id)

        if info.get("exists"):
            # Update existing deployment
            if enabled:
                result = await DeploymentManager.update_scheduled_deployment(
                    trigger_id=trigger_id,
                    workflow_id=workflow_id,
                    workflow_name=workflow_name,
                    cron_expression=cron_expression,
                    timezone=timezone,
                    trigger_name=trigger_name
                )
            else:
                # If disabled, pause the deployment
                result = await DeploymentManager.pause_scheduled_deployment(trigger_id)
        else:
            # Create new deployment
            result = await DeploymentManager.create_scheduled_deployment(
                trigger_id=trigger_id,
                workflow_id=workflow_id,
                workflow_name=workflow_name,
                cron_expression=cron_expression,
                timezone=timezone,
                trigger_name=trigger_name
            )

            # If trigger is disabled, immediately pause it
            if not enabled:
                await DeploymentManager.pause_scheduled_deployment(trigger_id)

        return result

    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def delete_deployment(args):
    """Delete a deployment."""
    if len(args) < 2:
        return {
            "success": False,
            "error": "Usage: delete <trigger_id>"
        }

    trigger_id = args[1]

    try:
        result = await DeploymentManager.delete_scheduled_deployment(trigger_id)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def get_deployment_info(args):
    """Get deployment information."""
    if len(args) < 2:
        return {
            "success": False,
            "error": "Usage: info <trigger_id>"
        }

    trigger_id = args[1]

    try:
        info = await DeploymentManager.get_deployment_info(trigger_id)
        return {
            "success": True,
            **info
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def pause_deployment(args):
    """Pause a deployment."""
    if len(args) < 2:
        return {
            "success": False,
            "error": "Usage: pause <trigger_id>"
        }

    trigger_id = args[1]

    try:
        result = await DeploymentManager.pause_scheduled_deployment(trigger_id)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def resume_deployment(args):
    """Resume a deployment."""
    if len(args) < 2:
        return {
            "success": False,
            "error": "Usage: resume <trigger_id>"
        }

    trigger_id = args[1]

    try:
        result = await DeploymentManager.resume_scheduled_deployment(trigger_id)
        return result
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


async def main():
    """Main entry point for CLI invocation."""
    if len(sys.argv) < 2:
        error_response = {
            "success": False,
            "error": "Usage: python sync_deployment.py <command> [args...]\nCommands: sync, delete, info, pause, resume"
        }
        print(json.dumps(error_response))
        sys.exit(1)

    command = sys.argv[1].lower()

    if command == "sync":
        result = await sync_deployment(sys.argv[1:])
    elif command == "delete":
        result = await delete_deployment(sys.argv[1:])
    elif command == "info":
        result = await get_deployment_info(sys.argv[1:])
    elif command == "pause":
        result = await pause_deployment(sys.argv[1:])
    elif command == "resume":
        result = await resume_deployment(sys.argv[1:])
    else:
        result = {
            "success": False,
            "error": f"Unknown command: {command}. Available commands: sync, delete, info, pause, resume"
        }

    print(json.dumps(result))

    if result.get("success"):
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
