# FlowForge Integration Guide – Databricks

## Overview
- FlowForge can orchestrate Databricks workloads across AWS, Azure, and GCP tenants by packaging Databricks jobs/notebooks as Prefect tasks.
- Use FlowForge for workflow design, promotion, cataloging, and monitoring while Databricks handles Spark compute, Delta Lake, and ML workloads.
- Integration points include: triggering Databricks Jobs API, executing Delta Live Tables, updating Unity Catalog metadata, and ingesting Delta outputs into FlowForge’s bronze/silver/gold layers.

## Architecture Pattern
1. **FlowForge Control Plane** handles workflow and job definitions, credential management, and environment promotion.
2. **Prefect Data Plane** runs in the customer’s cloud (AKS/EKS/GKE) with access to Databricks REST APIs and storage.
3. **Databricks Workspace** hosts clusters, jobs, Unity Catalog, and Delta tables.
4. **Storage** remains on customer-owned S3/ADLS/GCS; bronze/silver/gold assets can be either Parquet files managed by FlowForge or Delta tables managed by Databricks.

```
FlowForge UI ──▶ Prefect Task ──▶ Databricks Jobs API ──▶ Cluster/Notebook/Delta Pipeline
       ▲                 │
       │                 └──▶ Storage sync (Parquet/Delta) + Unity Catalog updates
       └──▶ Metadata catalog + execution logs
```

## Prerequisites
- Databricks workspace with token-based or OAuth authentication, Unity Catalog (optional).
- Network connectivity between Prefect workers and the Databricks control plane (VNet/VPC peering or public endpoint allowlist).
- Object storage (S3/ADLS/GCS) accessible to both Prefect tasks and Databricks clusters.
- Service principal or PAT stored in FlowForge secret manager (Key Vault/Secrets Manager/Secret Manager).

## Prefect Task Patterns
### Launch a Databricks Job
```python
from prefect import task
from prefect.databricks import DatabricksCredentials, DatabricksJobRun

@task
def run_databricks_job(job_id: int, parameters: dict | None = None) -> dict:
    creds = DatabricksCredentials.load("flowforge-dbx-creds")
    run = DatabricksJobRun(credentials=creds, job_id=job_id)
    result = run.trigger(parameters=parameters or {})
    run.wait_for_completion(timeout=45 * 60)  # 45 minutes
    return result.model_dump()
```

### Execute a Notebook Ad Hoc
```python
@task
def run_notebook(path: str, cluster_id: str, params: dict | None = None):
    creds = DatabricksCredentials.load("flowforge-dbx-creds")
    client = creds.get_client()
    run = client.jobs.submit(
        run_name=f"flowforge-{path}",
        existing_cluster_id=cluster_id,
        notebook_task={"notebook_path": path, "base_parameters": params or {}},
    )
    client.jobs.wait_get_job_run(run["run_id"], timeout=3600)
```

### Sync Delta Lake Output
After Databricks writes a Delta table, FlowForge can register metadata through Prefect tasks:
```python
@task
def catalog_delta_table(table_name: str, catalog: str, schema: str):
    # Query Unity Catalog for schema + row counts
    # Persist to FlowForge metadata_catalog table
    ...
```

## Promotion Workflow
- Store Databricks job IDs, notebook paths, and Unity Catalog object URIs per environment (Dev/QA/UAT/Prod) in FlowForge configuration tables.
- On promotion, FlowForge updates Prefect deployment parameters and triggers Databricks deployment pipelines (e.g., Terraform/Databricks Asset Bundles).
- Optionally use Databricks Repos to manage notebooks; FlowForge can call Git-based deployments before promotion.

## Monitoring & Lineage
- Prefect captures run status, logs, and outputs; use webhooks to send Databricks run events back to FlowForge for end-to-end traceability.
- Unity Catalog lineage and FlowForge metadata catalog can be joined using table identifiers; FlowForge can surface Unity Catalog asset health in the UI.

## Security Considerations
- Prefer OAuth/Service Principals over PATs; store secrets in customer-managed vaults.
- Limit API scopes and tie access to environment-specific Databricks workspace groups.
- Ensure network paths between Prefect workers and Databricks are secured (Private Link/Endpoints where available).

## Advanced Integrations
- Trigger Delta Live Tables pipelines from FlowForge for declarative ETL.
- Use Databricks SQL Warehouse for analytics and expose query outputs via FlowForge dashboards.
- Register MLflow models created in Databricks and surface deployment status in FlowForge.

## See Also
- `docs/integration-snowflake.md`
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/flowforge-multicloud-roadmap.md`
