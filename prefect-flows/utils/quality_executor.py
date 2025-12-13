"""
Quality Rule Executor - Executes data quality validation rules on DataFrames
Integrates with Silver layer to enforce quality checks and quarantine failed records
"""

from typing import Dict, List, Any, Optional
import polars as pl
import re
from prefect import get_run_logger


class QualityRuleExecutor:
    """Executes data quality rules and quarantines failed records"""

    def __init__(self, rules: List[Dict[str, Any]]):
        """
        Initialize executor with quality rules

        Args:
            rules: List of quality rule dictionaries from database
        """
        self.rules = rules
        self.logger = get_run_logger()

    def execute_all_rules(self, df: pl.DataFrame) -> Dict[str, Any]:
        """
        Execute all quality rules on DataFrame

        Args:
            df: Polars DataFrame to validate

        Returns:
            Dictionary with execution results and quarantined records
        """
        results = {
            "total_rules": len(self.rules),
            "passed_rules": 0,
            "failed_rules": 0,
            "warning_rules": 0,
            "total_records": len(df),
            "passed_records": len(df),
            "failed_records": 0,
            "quarantined_records": [],
            "rule_executions": []
        }

        if len(self.rules) == 0:
            self.logger.info("No quality rules to execute")
            return results

        self.logger.info(f"Executing {len(self.rules)} quality rules on {len(df)} records")

        # Track failed record IDs across all rules
        all_failed_indices = set()

        for rule in self.rules:
            if not rule.get('is_active', True):
                self.logger.info(f"Skipping inactive rule: {rule['rule_name']}")
                continue

            try:
                execution_result = self._execute_rule(df, rule)
                results["rule_executions"].append(execution_result)

                if execution_result["status"] == "passed":
                    results["passed_rules"] += 1
                elif execution_result["status"] == "failed":
                    results["failed_rules"] += 1
                    # Collect failed record indices
                    all_failed_indices.update(execution_result.get("failed_indices", []))
                elif execution_result["status"] == "warning":
                    results["warning_rules"] += 1

            except Exception as e:
                self.logger.error(f"Error executing rule {rule['rule_name']}: {str(e)}")
                results["rule_executions"].append({
                    "rule_id": rule["id"],
                    "rule_name": rule["rule_name"],
                    "status": "failed",
                    "error_message": str(e),
                    "records_checked": 0,
                    "records_passed": 0,
                    "records_failed": 0,
                    "pass_percentage": 0.0
                })
                results["failed_rules"] += 1

        # Quarantine records that failed any rule
        if all_failed_indices:
            results["failed_records"] = len(all_failed_indices)
            results["passed_records"] = len(df) - len(all_failed_indices)

            # Get quarantined records
            failed_indices_list = sorted(list(all_failed_indices))
            quarantined_df = df[failed_indices_list]
            results["quarantined_records"] = quarantined_df.to_dicts()

            self.logger.warning(
                f"Quarantined {len(all_failed_indices)} records that failed quality checks"
            )

        # Calculate overall quality score
        if results["total_records"] > 0:
            results["quality_score"] = round(
                (results["passed_records"] / results["total_records"]) * 100, 2
            )
        else:
            results["quality_score"] = 100.0

        self.logger.info(
            f"Quality execution complete: {results['passed_rules']}/{results['total_rules']} rules passed, "
            f"Quality score: {results['quality_score']}%"
        )

        return results

    def _execute_rule(self, df: pl.DataFrame, rule: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single quality rule"""
        rule_type = rule["rule_type"]
        column_name = rule["column_name"]
        parameters = rule.get("parameters", {})

        self.logger.info(f"Executing rule: {rule['rule_name']} ({rule_type}) on column: {column_name}")

        # Check if column exists
        if column_name not in df.columns:
            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "status": "failed",
                "error_message": f"Column '{column_name}' not found in dataset",
                "records_checked": 0,
                "records_passed": 0,
                "records_failed": 0
            }

        # Execute rule based on type
        if rule_type == "not_null":
            return self._execute_not_null(df, column_name, rule)
        elif rule_type == "unique":
            return self._execute_unique(df, column_name, rule)
        elif rule_type == "range":
            return self._execute_range(df, column_name, parameters, rule)
        elif rule_type == "pattern":
            return self._execute_pattern(df, column_name, parameters, rule)
        elif rule_type == "enum":
            return self._execute_enum(df, column_name, parameters, rule)
        elif rule_type == "custom":
            return self._execute_custom(df, column_name, parameters, rule)
        else:
            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "status": "failed",
                "error_message": f"Unknown rule type: {rule_type}",
                "records_checked": 0,
                "records_passed": 0,
                "records_failed": 0
            }

    def _execute_not_null(self, df: pl.DataFrame, column: str, rule: Dict) -> Dict:
        """Execute NOT NULL rule"""
        null_mask = df[column].is_null()
        failed_count = null_mask.sum()
        passed_count = len(df) - failed_count

        # Get indices of failed records
        failed_indices = [i for i, is_null in enumerate(null_mask.to_list()) if is_null]

        # Sample failed records
        failed_sample = []
        if failed_indices:
            sample_size = min(10, len(failed_indices))
            sample_indices = failed_indices[:sample_size]
            failed_sample = df[sample_indices].to_dicts()

        status = "passed" if failed_count == 0 else ("warning" if rule["severity"] == "warning" else "failed")

        return {
            "rule_id": rule["id"],
            "rule_name": rule["rule_name"],
            "column_name": column,
            "rule_type": "not_null",
            "status": status,
            "records_checked": len(df),
            "records_passed": passed_count,
            "records_failed": failed_count,
            "pass_percentage": round((passed_count / len(df)) * 100, 2),
            "failed_indices": failed_indices,
            "failed_records_sample": failed_sample,
            "error_message": f"{failed_count} NULL values found" if failed_count > 0 else None
        }

    def _execute_unique(self, df: pl.DataFrame, column: str, rule: Dict) -> Dict:
        """Execute UNIQUE rule"""
        # Find duplicates
        duplicates = df.filter(df[column].is_duplicated())
        failed_count = len(duplicates)
        passed_count = len(df) - failed_count

        # Get indices of duplicate records
        is_duplicate = df[column].is_duplicated().to_list()
        failed_indices = [i for i, is_dup in enumerate(is_duplicate) if is_dup]

        # Sample failed records
        failed_sample = duplicates.head(10).to_dicts() if failed_count > 0 else []

        status = "passed" if failed_count == 0 else ("warning" if rule["severity"] == "warning" else "failed")

        return {
            "rule_id": rule["id"],
            "rule_name": rule["rule_name"],
            "column_name": column,
            "rule_type": "unique",
            "status": status,
            "records_checked": len(df),
            "records_passed": passed_count,
            "records_failed": failed_count,
            "pass_percentage": round((passed_count / len(df)) * 100, 2),
            "failed_indices": failed_indices,
            "failed_records_sample": failed_sample,
            "error_message": f"{failed_count} duplicate values found" if failed_count > 0 else None
        }

    def _execute_range(self, df: pl.DataFrame, column: str, params: Dict, rule: Dict) -> Dict:
        """Execute RANGE rule (numeric min/max)"""
        min_val = params.get("min")
        max_val = params.get("max")

        # Filter out of range values
        mask = pl.lit(True)
        if min_val is not None:
            mask = mask & (df[column] >= min_val)
        if max_val is not None:
            mask = mask & (df[column] <= max_val)

        passed_mask = mask
        failed_mask = ~mask
        failed_count = failed_mask.sum()
        passed_count = len(df) - failed_count

        # Get indices of failed records
        failed_indices = [i for i, failed in enumerate(failed_mask.to_list()) if failed]

        # Sample failed records
        failed_sample = []
        if failed_indices:
            sample_size = min(10, len(failed_indices))
            failed_sample = df[failed_indices[:sample_size]].to_dicts()

        status = "passed" if failed_count == 0 else ("warning" if rule["severity"] == "warning" else "failed")

        return {
            "rule_id": rule["id"],
            "rule_name": rule["rule_name"],
            "column_name": column,
            "rule_type": "range",
            "status": status,
            "records_checked": len(df),
            "records_passed": passed_count,
            "records_failed": failed_count,
            "pass_percentage": round((passed_count / len(df)) * 100, 2),
            "failed_indices": failed_indices,
            "failed_records_sample": failed_sample,
            "error_message": f"{failed_count} values out of range [{min_val}, {max_val}]" if failed_count > 0 else None
        }

    def _execute_pattern(self, df: pl.DataFrame, column: str, params: Dict, rule: Dict) -> Dict:
        """Execute PATTERN rule (regex)"""
        pattern = params.get("pattern")
        if not pattern:
            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "status": "failed",
                "error_message": "No pattern specified",
                "records_checked": 0,
                "records_passed": 0,
                "records_failed": 0
            }

        # Check pattern match
        try:
            matches = df[column].str.contains(pattern)
            failed_mask = ~matches
            failed_count = failed_mask.sum()
            passed_count = len(df) - failed_count

            # Get indices of failed records
            failed_indices = [i for i, failed in enumerate(failed_mask.to_list()) if failed]

            # Sample failed records
            failed_sample = []
            if failed_indices:
                sample_size = min(10, len(failed_indices))
                failed_sample = df[failed_indices[:sample_size]].to_dicts()

            status = "passed" if failed_count == 0 else ("warning" if rule["severity"] == "warning" else "failed")

            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "column_name": column,
                "rule_type": "pattern",
                "status": status,
                "records_checked": len(df),
                "records_passed": passed_count,
                "records_failed": failed_count,
                "pass_percentage": round((passed_count / len(df)) * 100, 2),
                "failed_indices": failed_indices,
                "failed_records_sample": failed_sample,
                "error_message": f"{failed_count} values do not match pattern" if failed_count > 0 else None
            }
        except Exception as e:
            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "status": "failed",
                "error_message": f"Pattern execution error: {str(e)}",
                "records_checked": 0,
                "records_passed": 0,
                "records_failed": 0
            }

    def _execute_enum(self, df: pl.DataFrame, column: str, params: Dict, rule: Dict) -> Dict:
        """Execute ENUM rule (allowed values)"""
        allowed_values = params.get("allowed_values", [])
        if not allowed_values:
            return {
                "rule_id": rule["id"],
                "rule_name": rule["rule_name"],
                "status": "failed",
                "error_message": "No allowed values specified",
                "records_checked": 0,
                "records_passed": 0,
                "records_failed": 0
            }

        # Check if values are in allowed list
        is_valid = df[column].is_in(allowed_values)
        failed_mask = ~is_valid
        failed_count = failed_mask.sum()
        passed_count = len(df) - failed_count

        # Get indices of failed records
        failed_indices = [i for i, failed in enumerate(failed_mask.to_list()) if failed]

        # Sample failed records
        failed_sample = []
        if failed_indices:
            sample_size = min(10, len(failed_indices))
            failed_sample = df[failed_indices[:sample_size]].to_dicts()

        status = "passed" if failed_count == 0 else ("warning" if rule["severity"] == "warning" else "failed")

        return {
            "rule_id": rule["id"],
            "rule_name": rule["rule_name"],
            "column_name": column,
            "rule_type": "enum",
            "status": status,
            "records_checked": len(df),
            "records_passed": passed_count,
            "records_failed": failed_count,
            "pass_percentage": round((passed_count / len(df)) * 100, 2),
            "failed_indices": failed_indices,
            "failed_records_sample": failed_sample,
            "error_message": f"{failed_count} values not in allowed list" if failed_count > 0 else None
        }

    def _execute_custom(self, df: pl.DataFrame, column: str, params: Dict, rule: Dict) -> Dict:
        """Execute CUSTOM SQL-like rule"""
        # Custom rules would require SQL expression evaluation
        # For now, return not implemented
        return {
            "rule_id": rule["id"],
            "rule_name": rule["rule_name"],
            "status": "failed",
            "error_message": "Custom rules not yet implemented",
            "records_checked": 0,
            "records_passed": 0,
            "records_failed": 0
        }


def execute_quality_rules(
    df: pl.DataFrame,
    rules: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Convenience function to execute quality rules

    Args:
        df: Polars DataFrame to validate
        rules: List of quality rule dictionaries

    Returns:
        Execution results with quarantined records
    """
    executor = QualityRuleExecutor(rules)
    return executor.execute_all_rules(df)
