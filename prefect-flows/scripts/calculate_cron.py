#!/usr/bin/env python3
"""
Standalone script to calculate next cron runs.

This script can be invoked from Node.js to calculate cron schedules.
Usage: python calculate_cron.py <cron_expression> <timezone> <count>

Example: python calculate_cron.py "0 2 * * *" "UTC" 5
"""

import sys
import json
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.cron_utils import calculate_next_runs, validate_cron_expression, format_cron_description


def main():
    """Main entry point for CLI invocation."""
    if len(sys.argv) < 4:
        error_response = {
            "success": False,
            "error": "Usage: python calculate_cron.py <cron_expression> <timezone> <count>"
        }
        print(json.dumps(error_response))
        sys.exit(1)

    cron_expression = sys.argv[1]
    timezone = sys.argv[2]

    try:
        count = int(sys.argv[3])
    except ValueError:
        error_response = {
            "success": False,
            "error": f"Invalid count value: {sys.argv[3]}"
        }
        print(json.dumps(error_response))
        sys.exit(1)

    # Validate cron expression
    is_valid, error_msg = validate_cron_expression(cron_expression)
    if not is_valid:
        error_response = {
            "success": False,
            "error": error_msg
        }
        print(json.dumps(error_response))
        sys.exit(1)

    try:
        # Calculate next runs
        next_runs = calculate_next_runs(cron_expression, timezone, count)

        # Convert to Unix timestamps
        timestamps = [int(dt.timestamp()) for dt in next_runs]

        # Generate description
        description = format_cron_description(cron_expression)

        # Return success response
        response = {
            "success": True,
            "nextRuns": timestamps,
            "cronExpression": cron_expression,
            "timezone": timezone,
            "description": description
        }

        print(json.dumps(response))
        sys.exit(0)

    except Exception as e:
        error_response = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_response))
        sys.exit(1)


if __name__ == "__main__":
    main()
