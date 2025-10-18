# FlowForge Deployment Guide – Microsoft Fabric

## Overview
- Deploy FlowForge within a customer’s Microsoft Fabric tenant, leveraging Azure-native hosting for the application while integrating tightly with Fabric workspaces, OneLake storage, and Fabric pipelines.
- Maintain the FlowForge control plane (Next.js UI/API, metadata services) in Azure, but adapt the data plane to orchestrate Fabric-native compute (Data Pipelines, Spark, Data Factory in Fabric).
- Provide Dev → QA → UAT → Prod environment separation using Azure subscriptions, Fabric capacities/workspaces, and CI/CD (Azure DevOps or GitHub Actions with Fabric deployment pipelines).

## Service Mapping
- **Application Hosting**: Azure App Service / Container Apps for FlowForge UI/API (same as Azure deployment).
- **Orchestration Runtime**: Prefect running on Azure Kubernetes Service; tasks invoke Fabric pipeline REST APIs, notebooks, or Spark jobs.
- **Storage**: Microsoft Fabric OneLake (lakehouse) as the primary storage target; Azure Blob Storage can serve as landing zone if required.
- **Metadata Database**: Azure Database for PostgreSQL (shared service for FlowForge metadata).
- **Identity & Secrets**: Microsoft Entra ID (Azure AD) for SSO, Azure Key Vault for secrets; service principals with Fabric admin permissions.
- **Monitoring**: Azure Monitor + Fabric monitoring APIs for pipeline run telemetry.

## Reference Architecture
1. **Control Plane**
   - FlowForge web app hosted in Azure App Service with Managed Identity, connected to PostgreSQL and Key Vault.
   - Uses Microsoft Graph / Fabric REST APIs via service principal to enumerate workspaces, pipelines, lakehouses.
2. **Data Plane**
   - Prefect workers on AKS call Fabric REST endpoints (`/pipelineRuns`, `/sparkJobDefinitions`) or trigger Synapse-style notebooks in Fabric.
   - OneLake serves as bronze/silver/gold storage; FlowForge tracks metadata in PostgreSQL.
3. **Environment Separation**
   - Azure subscriptions for infrastructure (one per environment).
   - Fabric capacities and workspaces per environment; FlowForge stores workspace IDs and capacity assignments in configuration.

## Prerequisites
- Customer Fabric tenant with dedicated capacities/licenses.
- Azure subscription for hosting FlowForge control plane and Prefect.
- Service principals with delegated permissions to Fabric APIs, OneLake, and Power BI workspace management.
- Terraform/Bicep templates for the Azure components; YAML templates for Fabric deployment pipelines.

## Deployment Steps
1. **Provision Azure Infrastructure**
   - Follow the Azure deployment guide for networking, App Service, PostgreSQL, Key Vault, and AKS.
   - Register an app in Entra ID with Fabric API permissions (Tenant.Read.All, Workspace.ReadWrite.All, Pipeline.ReadWrite.All).
2. **Configure Fabric Resources**
   - Create Fabric capacities per environment; assign workspaces for landing, bronze, silver, gold lakehouses, and pipelines.
   - Establish Fabric deployment pipelines if the customer wants governed promotion across workspaces.
3. **Integrate Prefect with Fabric**
   - Implement Prefect tasks that call Fabric REST APIs to trigger pipelines/notebooks and poll run status.
   - Store Fabric workspace IDs, pipeline IDs, and OneLake paths in FlowForge metadata tables (tenant/environment scoped).
   - Use Managed Identity or service principal credentials stored in Key Vault for API calls.
4. **Update Storage Connectors**
   - Extend FlowForge storage abstraction to read/write parquet via Fabric OneLake endpoints (Delta Lake).
   - Optionally ingest data into OneLake by targeting the `abfss://` endpoints exposed through OneLake shortcuts.
5. **Deploy Control Plane**
   - Configure FlowForge env vars for Fabric API base URL, service principal IDs, and default workspace mappings.
   - Enable SSO with Entra ID; map Fabric roles to FlowForge RBAC.
6. **Register Prefect Deployments**
   - Prefect flows remain on AKS, but tasks now call Fabric pipeline IDs; use environment-specific work queues tied to Fabric capacities.
   - Provide prebuilt task templates for common actions: trigger Data Pipeline, submit Spark job, publish dataset, refresh semantic model.
7. **Monitoring & Alerts**
   - Capture Prefect run state plus Fabric pipeline run telemetry via Fabric monitoring APIs.
   - Emit metrics/logs to Azure Monitor and configure alert rules (failed runs, long durations, capacity saturation).
8. **Promotion Workflow**
   - Combine FlowForge environment promotion with Fabric deployment pipelines: upon promotion, FlowForge pushes configuration to next environment and triggers Fabric deployment pipeline stage.
   - Govern secrets via Key Vault per environment; rotate when promoting.

## Configuration Notes
- Ensure Fabric API throttling limits are respected; Prefect tasks should implement retries with exponential backoff.
- For large data volumes, consider using Azure Data Factory integration runtimes to stage data before landing in OneLake.
- Map FlowForge metadata (bronze/silver/gold) to Fabric lakehouse tables and keep schema registry synchronized.

## Operations & Handover
- Provide runbooks for managing Fabric capacities, refreshing deployment pipelines, updating service principal permissions, and monitoring costs.
- Outline backup/restore strategy: FlowForge metadata via PostgreSQL backups; OneLake data via Fabric snapshots/shortcuts to ADLS.
- Train client teams on Prefect dashboards (self-hosted or Cloud) plus Fabric monitoring tools.

## Optional Enhancements
- Integrate Power BI dataset refreshes and deployment pipeline approvals directly into FlowForge UI.
- Implement AI-based schema mapping leveraging Fabric Data Activator for event-driven triggers.
- Connect FlowForge catalog with Microsoft Purview to centralize governance across Fabric and non-Fabric assets.

## See Also
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/flowforge-multicloud-roadmap.md`
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/integration-partner-ecosystem.md`
