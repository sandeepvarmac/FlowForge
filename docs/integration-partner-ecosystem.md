# FlowForge Integration Guide – Partner & Tool Ecosystem

## Overview
- FlowForge is intentionally vendor-agnostic; Prefect flows can invoke any external platform that exposes an API, SDK, CLI, or message interface.
- This guide describes integration patterns for common tooling families—transformation (dbt, Spark, Synapse), orchestration (Airflow, ADF), machine learning (SageMaker, Vertex AI), observability (Datadog, Grafana), and collaboration (ServiceNow, Slack).
- Use these patterns to extend FlowForge for customers with existing investments while keeping a single control plane for workflow design, promotion, and governance.

## Integration Categories
### Transformation & Compute Engines
- **dbt**: Run `dbt build` via Prefect tasks (shell or dbt Cloud API). Capture manifest artifacts and sync test results back to FlowForge metadata.
- **Apache Spark / Kubernetes Spark Operators**: Submit jobs with Spark REST API, Kubernetes custom resources, or cloud-specific services (Glue, EMR, Synapse Spark, Dataproc).
- **Azure Synapse, Google BigQuery, AWS Glue**: Use provider SDKs to trigger pipelines or stored procedures; reuse FlowForge’s storage layers as input sources.

### Data Movement & Orchestrators
- **Azure Data Factory / Synapse Pipelines**: Invoke pipeline runs through REST API; monitor status with pollers and feed results into FlowForge triggers. Useful when customers prefer native data movement but want FlowForge catalogs and promotion gates.
- **Apache Airflow**: Call Airflow DAG runs (REST API) or let FlowForge publish DAG definitions; treat Airflow as a downstream orchestrator while FlowForge manages environment migration.

### Warehouses & Lakehouses
- **Snowflake / Databricks**: See dedicated guides (`integration-snowflake`, `integration-databricks`).
- **BigQuery / Redshift / Synapse SQL**: Use cloud SDKs to run SQL queries, load Parquet data, and collect job statistics for FlowForge dashboards.

### Machine Learning & Streaming
- **AWS SageMaker / Azure ML / Vertex AI**: Prefect tasks submit training jobs, batch predictions, or pipeline executions. Track model registry updates and link artifacts to FlowForge catalog entries.
- **Kafka / Event Hubs / Pub/Sub**: Use message producers/consumers to trigger FlowForge workflows based on data arrival; pair with Prefect event-driven flows.

### Observability & Incident Response
- **Datadog, Grafana, Prometheus**: Emit metrics and traces from Prefect tasks; configure FlowForge to send alerts or dashboards through these platforms.
- **ServiceNow, Jira, Slack, Teams**: Notify stakeholders on pipeline success/failure; gather approvals for environment promotions via chatops integrations.

## Implementation Pattern
1. **Identify Integration Point**: Determine whether the tool is a task target (FlowForge triggers it) or a source (it triggers FlowForge).
2. **Choose Connector**: Prefect Collections provide ready-made tasks for many platforms (e.g., `prefect-dbt`, `prefect-azure`, `prefect-slack`). For others, build custom tasks using official SDKs.
3. **Secure Credentials**: Store API keys, tokens, or service principal info in customer-managed secret vaults; bind them to Prefect blocks per environment.
4. **Model Configuration**: Extend FlowForge job definitions to include the external tool’s identifiers (job IDs, dataset names, repo paths). Use environment-specific overrides for Dev/QA/UAT/Prod.
5. **Capture Observability**: Write task results (run IDs, metrics, logs) into FlowForge’s metadata tables. Optionally query the external tool’s monitoring APIs to enrich dashboards.
6. **Handle Promotion**: Ensure integration parameters (e.g., dbt target profiles, Glue job names) are versioned and migrated alongside workflows; rely on Terraform or provider-specific deployment pipelines where needed.

## Example: Trigger dbt Cloud Job
```python
from prefect import task
from prefect_dbt.cloud import DbtCloudJobRun

@task
def run_dbt_cloud(job_id: int, cause: str):
    runner = DbtCloudJobRun.load("flowforge-dbt")
    result = runner.trigger_and_wait_for_completion(job_id=job_id, cause=cause, timeout=3600)
    return result.model_dump()
```

## Example: Call Azure Data Factory Pipeline
```python
from prefect import task
from azure.identity import ClientSecretCredential
from azure.mgmt.datafactory import DataFactoryManagementClient

@task
def run_adf_pipeline(subscription_id, resource_group, factory_name, pipeline_name, parameters):
    credential = ClientSecretCredential(
        tenant_id=...,
        client_id=...,
        client_secret=...
    )
    client = DataFactoryManagementClient(credential, subscription_id)
    run = client.pipelines.create_run(resource_group, factory_name, pipeline_name, parameters=parameters)
    client.pipeline_runs.get(resource_group, factory_name, run.run_id)  # poll or return run_id for async monitoring
    return run.run_id
```

## Governance & Catalog Sync
- Register external tool outputs (tables, files, dashboards) in FlowForge metadata catalog to provide unified lineage.
- Support bidirectional sync with enterprise catalogs (Purview, Glue, Collibra) to keep stewardship records aligned.

## Operational Considerations
- Standardize logging format so FlowForge, Prefect, and partner tools share correlation IDs (execution ID, run ID).
- Implement retry/backoff strategies when calling external APIs; integrate circuit breakers to avoid cascading failures.
- Maintain versioned configuration for each integration to simplify rollbacks during promotions.

## See Also
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/flowforge-multicloud-roadmap.md`
