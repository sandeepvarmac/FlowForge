"""
Dataset Job Flow

Layer-centric Prefect flow that executes a single Dataset Job.
Routes to the appropriate task based on target layer (silver or gold).

For Bronze layer, use the existing medallion flow with disabled Silver/Gold layers.
"""

from __future__ import annotations

from typing import Optional
import uuid

from prefect import flow, get_run_logger

from tasks.silver_dataset_job import silver_dataset_job
from tasks.gold_dataset_job import gold_dataset_job


@flow(name="flowforge-dataset-job")
def dataset_job_flow(
    job_id: str,
    job_name: str,
    target_layer: str,
    input_datasets: list[str],
    transform_sql: str,
    output_table_name: str,
    *,
    source_id: str | None = None,
    execution_id: str | None = None,
    environment: str = "prod",
    layer_config: dict | None = None,
) -> dict:
    """
    Execute a layer-centric Dataset Job.

    This flow routes to the appropriate task based on target_layer:
    - 'silver': Executes silver_dataset_job (joins Bronze inputs)
    - 'gold': Executes gold_dataset_job (aggregates Silver inputs)

    For 'bronze' layer jobs, use the standard medallion flow with
    Silver/Gold layers disabled.

    Args:
        job_id: Unique job identifier
        job_name: Human-readable job name
        target_layer: Target layer ('silver' or 'gold')
        input_datasets: List of input table names from catalog
        transform_sql: SQL query to execute
        output_table_name: Output table name
        source_id: Optional source ID for tracking
        execution_id: Optional execution ID
        environment: Environment (dev, qa, uat, prod)
        layer_config: Optional layer-specific configuration

    Returns:
        Dict with job results including output path and record count
    """
    logger = get_run_logger()
    run_id = str(uuid.uuid4())[:8]

    logger.info("=" * 70)
    logger.info("🔄 DATASET JOB FLOW")
    logger.info("=" * 70)
    logger.info(f"Job ID: {job_id}")
    logger.info(f"Job Name: {job_name}")
    logger.info(f"Target Layer: {target_layer}")
    logger.info(f"Output Table: {output_table_name}")
    logger.info(f"Input Datasets: {input_datasets}")
    logger.info(f"Environment: {environment}")
    logger.info(f"Run ID: {run_id}")
    logger.info("=" * 70)

    result = None

    try:
        if target_layer == "silver":
            logger.info("\n📌 Routing to Silver Dataset Job...")
            result = silver_dataset_job(
                input_datasets=input_datasets,
                transform_sql=transform_sql,
                output_table_name=output_table_name,
                source_id=source_id,
                execution_id=execution_id,
                environment=environment,
                silver_config=layer_config,
            )

        elif target_layer == "gold":
            logger.info("\n📌 Routing to Gold Dataset Job...")
            result = gold_dataset_job(
                input_datasets=input_datasets,
                transform_sql=transform_sql,
                output_table_name=output_table_name,
                source_id=source_id,
                execution_id=execution_id,
                environment=environment,
                gold_config=layer_config,
            )

        elif target_layer == "bronze":
            raise ValueError(
                "Bronze layer Dataset Jobs should use the standard medallion flow "
                "with Silver/Gold layers disabled. This flow is for Silver/Gold "
                "cross-source transformations only."
            )

        else:
            raise ValueError(f"Invalid target_layer: {target_layer}. Must be 'silver' or 'gold'.")

        logger.info("\n" + "=" * 70)
        logger.info("✅ DATASET JOB FLOW COMPLETE")
        logger.info("=" * 70)

        return {
            "status": "success",
            "job_id": job_id,
            "job_name": job_name,
            "target_layer": target_layer,
            "output_table_name": output_table_name,
            "run_id": run_id,
            **result,
        }

    except Exception as e:
        logger.error(f"\n❌ DATASET JOB FLOW FAILED: {e}")
        import traceback
        logger.error(traceback.format_exc())

        return {
            "status": "failed",
            "job_id": job_id,
            "job_name": job_name,
            "target_layer": target_layer,
            "output_table_name": output_table_name,
            "run_id": run_id,
            "error": str(e),
        }


# Convenience function for testing
if __name__ == "__main__":
    # Example: Test Silver Dataset Job locally
    # This requires existing Bronze tables in the catalog

    test_result = dataset_job_flow(
        job_id="test-job-001",
        job_name="Test Customer Orders Join",
        target_layer="silver",
        input_datasets=["loan_payments_bronze", "customers_bronze"],
        transform_sql="""
            SELECT
                lp.*,
                c.customer_name,
                c.email
            FROM loan_payments_bronze lp
            LEFT JOIN customers_bronze c ON lp.customer_id = c.id
        """,
        output_table_name="customer_loan_payments_silver",
        environment="prod",
    )

    print("\n" + "=" * 50)
    print("TEST RESULT:")
    print("=" * 50)
    for key, value in test_result.items():
        print(f"  {key}: {value}")
