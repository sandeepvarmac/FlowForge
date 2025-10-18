# FlowForge Integration Guide – Snowflake

## Overview
- FlowForge orchestrates Snowflake workloads for ELT/ETL, analytics, and data sharing by wrapping Snowflake SQL/Snowpark operations inside Prefect tasks.
- Use FlowForge to manage workflow definitions, promotion, and observability while Snowflake handles compute warehouses, storage, and governance.
- Integration covers: running SQL scripts, orchestrating Snowpark notebooks, managing stages/external tables, and syncing metadata with FlowForge’s catalog.

## Architecture Pattern
1. **FlowForge Control Plane** stores workflow/job definitions, environment configs, and RBAC assignments.
2. **Prefect Data Plane** connects to Snowflake using user/password, key-pair auth, or OAuth; runs inside customer cloud (AKS/EKS/GKE).
3. **Snowflake Account** provides warehouses, databases, and tasks; can access S3/ADLS/GCS external stages created by FlowForge.
4. **Storage**: FlowForge bronze/silver/gold layers can live in cloud object storage (external stage) or within Snowflake internal tables.

```
FlowForge Workflow ──▶ Prefect Task ──▶ Snowflake Connector/Snowpark ──▶ Warehouse Execution
       ▲                          │
       └── Metadata catalog ◀─────┘
```

## Prerequisites
- Snowflake account, role hierarchy, warehouses sized for pipeline workloads.
- Network paths from Prefect workers to Snowflake (public Internet with IP allowlist or PrivateLink).
- Secrets stored in Key Vault / Secrets Manager / Secret Manager (username/password or key pair, OAuth client info).
- Optional: External stages configured to read/write FlowForge-managed Parquet/Delta files.

## Prefect Task Patterns
### Execute SQL Batch
```python
from prefect import task
from prefect_snowflake.database import SnowflakeConnector

@task
def run_sql(command: str, parameters: dict | None = None):
    connector = SnowflakeConnector.load("flowforge-snowflake")
    with connector.get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(command, parameters or {})
        return cursor.fetchall()
```

### Load Parquet from Bronze Layer
```python
@task
def load_parquet_to_snowflake(stage: str, table: str, file_pattern: str):
    command = f\"\"\"
        COPY INTO {table}
        FROM @{stage}/{file_pattern}
        FILE_FORMAT = (TYPE = PARQUET)
        ON_ERROR = 'CONTINUE'
    \"\"\"
    run_sql.submit(command)
```

### Invoke Snowpark Function
```python
from prefect import flow
from prefect_snowflake.snowpark import SnowparkSession

@task
def run_snowpark(session_config_block: str, script_path: str):
    session = SnowparkSession.load(session_config_block).get_session()
    with open(script_path, "r", encoding="utf-8") as script:
        exec(script.read(), {"session": session})
```

## Promotion Workflow
- Store per-environment Snowflake account/role/warehouse names in FlowForge configuration tables.
- Use Terraform/Snowflake Change Management to create databases, schemas, roles, and warehouses in each environment.
- FlowForge environment promotion updates Prefect deployment parameters (e.g., set `SNOWFLAKE_ROLE=FF_PROD`, `WAREHOUSE=FF_WH_PROD`) and migrates metadata catalog entries.
- Optionally integrate with Snowflake Tasks/Streams: FlowForge can trigger/monitor tasks or pause/resume them during promotions.

## Monitoring & Governance
- Prefect captures pipeline execution logs; push run metadata back to Snowflake tables for centralized reporting.
- Query `SNOWFLAKE.ACCOUNT_USAGE` views (e.g., `QUERY_HISTORY`, `WAREHOUSE_LOAD_HISTORY`) to populate FlowForge dashboards with cost/perf insights.
- Integrate FlowForge’s catalog with Snowflake’s object tags and masking policies for governance alignment.

## Security Considerations
- Prefer key-pair + key rotation or external OAuth; store secrets in customer-managed secret vaults.
- Set least-privilege roles for FlowForge service accounts; restrict to specific warehouses/databases.
- Implement network policies/PrivateLink endpoints when running Prefect in customer VPC/VNet.

## Advanced Integrations
- Trigger Snowpipe for continuous ingestion; FlowForge publishes landing files to external stages, then monitors load completion.
- Use Snowpark Container Services for advanced workloads; FlowForge tasks package and deploy containers.
- Surface data sharing or marketplace flows via FlowForge UI to empower business partners.

## See Also
- `docs/integration-databricks.md`
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/flowforge-multicloud-roadmap.md`
