"""
Cron expression utilities for FlowForge scheduled triggers.

Provides validation and next run calculation for cron expressions.
Uses croniter for robust cron parsing and datetime calculations.
"""

from datetime import datetime, timezone as dt_timezone
from typing import List, Optional
from croniter import croniter
import pytz


def validate_cron_expression(cron_expression: str) -> tuple[bool, Optional[str]]:
    """
    Validate a cron expression format.

    Args:
        cron_expression: Cron expression string (5 fields: minute hour day month weekday)

    Returns:
        Tuple of (is_valid, error_message)

    Examples:
        >>> validate_cron_expression("0 2 * * *")
        (True, None)
        >>> validate_cron_expression("invalid")
        (False, "Invalid cron expression format")
    """
    if not cron_expression or not isinstance(cron_expression, str):
        return False, "Cron expression must be a non-empty string"

    # Check basic format (5 fields)
    parts = cron_expression.strip().split()
    if len(parts) != 5:
        return False, f"Cron expression must have exactly 5 fields (minute hour day month weekday), got {len(parts)}"

    try:
        # Use croniter to validate
        croniter(cron_expression)
        return True, None
    except (ValueError, KeyError) as e:
        return False, f"Invalid cron expression: {str(e)}"


def calculate_next_runs(
    cron_expression: str,
    timezone_str: str = "UTC",
    count: int = 5,
    start_time: Optional[datetime] = None
) -> List[datetime]:
    """
    Calculate the next N run times for a cron expression.

    Args:
        cron_expression: Valid cron expression (5 fields)
        timezone_str: Timezone name (e.g., "UTC", "America/New_York")
        count: Number of future runs to calculate (max 100)
        start_time: Starting point for calculation (defaults to now)

    Returns:
        List of datetime objects in the specified timezone

    Raises:
        ValueError: If cron expression or timezone is invalid

    Examples:
        >>> runs = calculate_next_runs("0 2 * * *", "UTC", 3)
        >>> len(runs)
        3
    """
    # Validate cron expression
    is_valid, error_msg = validate_cron_expression(cron_expression)
    if not is_valid:
        raise ValueError(error_msg)

    # Validate and load timezone
    try:
        tz = pytz.timezone(timezone_str)
    except pytz.exceptions.UnknownTimeZoneError:
        raise ValueError(f"Unknown timezone: {timezone_str}")

    # Limit count
    count = min(max(1, count), 100)

    # Use provided start time or current time in target timezone
    if start_time is None:
        start_time = datetime.now(tz)
    elif start_time.tzinfo is None:
        # If naive datetime, assume it's in target timezone
        start_time = tz.localize(start_time)
    else:
        # Convert to target timezone
        start_time = start_time.astimezone(tz)

    # Calculate next runs
    cron = croniter(cron_expression, start_time)
    next_runs = []

    for _ in range(count):
        next_run = cron.get_next(datetime)
        next_runs.append(next_run)

    return next_runs


def calculate_next_run(
    cron_expression: str,
    timezone_str: str = "UTC",
    start_time: Optional[datetime] = None
) -> datetime:
    """
    Calculate the next single run time for a cron expression.

    Args:
        cron_expression: Valid cron expression (5 fields)
        timezone_str: Timezone name (e.g., "UTC", "America/New_York")
        start_time: Starting point for calculation (defaults to now)

    Returns:
        Next run datetime in the specified timezone

    Raises:
        ValueError: If cron expression or timezone is invalid
    """
    runs = calculate_next_runs(cron_expression, timezone_str, 1, start_time)
    return runs[0]


def get_next_run_timestamp(
    cron_expression: str,
    timezone_str: str = "UTC",
    start_time: Optional[datetime] = None
) -> int:
    """
    Calculate the next run time as a Unix timestamp.

    Args:
        cron_expression: Valid cron expression (5 fields)
        timezone_str: Timezone name
        start_time: Starting point for calculation (defaults to now)

    Returns:
        Unix timestamp (seconds since epoch)
    """
    next_run = calculate_next_run(cron_expression, timezone_str, start_time)
    return int(next_run.timestamp())


def format_cron_description(cron_expression: str) -> str:
    """
    Generate a human-readable description of a cron expression.

    Args:
        cron_expression: Valid cron expression

    Returns:
        Human-readable description

    Examples:
        >>> format_cron_description("0 2 * * *")
        "Daily at 2:00 AM"
        >>> format_cron_description("*/15 * * * *")
        "Every 15 minutes"
    """
    # This is a simplified version - could be enhanced with cron-descriptor library
    parts = cron_expression.split()
    if len(parts) != 5:
        return cron_expression

    minute, hour, day, month, weekday = parts

    # Common patterns
    if cron_expression == "* * * * *":
        return "Every minute"

    if minute.startswith("*/"):
        interval = minute[2:]
        return f"Every {interval} minutes"

    if minute == "0" and hour == "*":
        return "Every hour"

    if minute == "0" and hour.startswith("*/"):
        interval = hour[2:]
        return f"Every {interval} hours"

    if day == "*" and month == "*" and weekday == "*":
        if hour == "*":
            return f"Every hour at minute {minute}"
        return f"Daily at {hour}:{minute.zfill(2)}"

    if day == "*" and month == "*" and weekday != "*":
        weekday_names = {
            "0": "Sunday", "1": "Monday", "2": "Tuesday", "3": "Wednesday",
            "4": "Thursday", "5": "Friday", "6": "Saturday"
        }
        day_name = weekday_names.get(weekday, f"day {weekday}")
        return f"Every {day_name} at {hour}:{minute.zfill(2)}"

    if day != "*" and month == "*" and weekday == "*":
        return f"Monthly on day {day} at {hour}:{minute.zfill(2)}"

    return cron_expression


# Prefect-specific utilities
def cron_to_prefect_schedule(cron_expression: str, timezone_str: str = "UTC") -> dict:
    """
    Convert cron expression to Prefect CronSchedule format.

    Args:
        cron_expression: Valid cron expression
        timezone_str: Timezone name

    Returns:
        Dictionary suitable for Prefect deployment schedule
    """
    is_valid, error_msg = validate_cron_expression(cron_expression)
    if not is_valid:
        raise ValueError(error_msg)

    return {
        "cron": cron_expression,
        "timezone": timezone_str
    }
