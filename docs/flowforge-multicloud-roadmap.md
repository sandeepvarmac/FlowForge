# FlowForge Multi-Cloud Platform Roadmap

## Current Snapshot
- **Control Plane**: Next.js app with workflow, trigger, and monitoring services backed by SQLite (`apps/web/src/lib/services/*`, `apps/web/src/lib/db/index.ts`).
- **Pipeline Runtime**: Prefect medallion flow orchestrating bronze → silver → gold tasks with execution callbacks (`prefect-flows/flows/medallion.py`, `prefect-flows/services/trigger_handler.py`).
- **Local Dependencies**: Docker Compose stack standing up MinIO (S3-compatible) and PostgreSQL for storage/metadata emulation (`docker-compose.yml`).

## Gaps vs. Databricks/Snowflake
- Single-tenant, single-environment deployment; no separation of FlowForge control plane from customer data plane.
- No managed packaging/versioning of Prefect assets for promotion across environments.
- Missing enterprise expectations: turnkey connectors, centralized catalog/lineage, RBAC/governance, elasticity, cost controls.

## Recommended Build-Out

### Multi-Cloud Architecture
- Split FlowForge into a managed control plane and pluggable data planes provisioned inside customer AWS/Azure/GCP/Fabric accounts.
- Ship Terraform/ARM/Deployment Manager blueprints and bootstrap automation to deploy workers/agents near customer data while maintaining central governance.

### Environment Lifecycle & Migration
- Introduce first-class “environment” resources (Dev/QA/UAT/Prod) with credential and config bundles.
- Package Prefect flows and Python assets into versioned bundles stored in a registry; provide promote/demote workflows that redeploy bundles and reconcile metadata.
- Add drift detection and diff tooling so users can inspect changes before promotion.

### Data & Compute Connectors
- Build provider plugins for storage (S3, ADLS/Blob, GCS, OneLake), compute engines (Databricks, AWS Glue, Azure Synapse, GCP Dataflow, Fabric), and warehouse targets (Snowflake, BigQuery, Redshift, Synapse).
- Expose a plugin SDK to let partners add connectors without modifying the core platform.

### CI/CD & GitOps
- Treat pipeline code, infrastructure definitions, and UI extensions as repositories.
- Provide GitHub/GitLab/Azure DevOps templates that lint/test flows, build artifacts, publish Prefect deployments, and trigger environment promotions after approvals.
- Let CI/CD handle code integration while promotion workflows manage data residency, configuration, and compliance gates.

### Metadata, Governance, and Observability
- Extend metadata services into a central catalog with schema history, quality checks, and end-to-end lineage of bronze/silver/gold assets.
- Integrate with enterprise catalogs (Purview, Glue Data Catalog, Collibra) and enable policy-based access controls, SSO/SAML/OAuth, audit logging, and encryption key management via cloud KMS.
- Add workload metrics, SLA tracking, autoscaling policies, and cost attribution dashboards for FinOps teams.

### Marketplace & Integrations
- Offer extensibility around transformations (dbt, Spark), MLOps, observability (Datadog, Prometheus/Grafana), ticketing (ServiceNow), and existing orchestrators.
- Ensure FlowForge agents can operate inside customer networks using their cloud licenses and IAM/service principals.

## Related Documents
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/deployment-fabric.md`
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/integration-partner-ecosystem.md`

## Clarifying CI/CD vs. Promotion
- **CI/CD Pipelines**: Automate building, testing, linting, bundling, and publishing FlowForge artifacts from source control.
- **Promotion/Migration Workflows**: Govern movement of validated bundles and data between environments, applying configuration overrides, approvals, data validation, and rollback controls.

## Immediate Next Steps
1. Finalize the control-plane/data-plane split and document reference topologies for AWS, Azure, GCP, and Fabric.
2. Define the environment model, artifact packaging format, and promotion workflow; prototype using Prefect deployments and Terraform workspaces.
3. Prioritize connector roadmap based on customer demand and publish the plugin SDK to accelerate partner contributions.
