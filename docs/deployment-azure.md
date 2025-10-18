# FlowForge Deployment Guide – Azure

## Overview
- Deploy FlowForge entirely inside a customer’s Azure subscription so they retain control of data, identities, and cost.
- Split architecture into **control plane** (Next.js UI/API, metadata services) and **data plane** (Prefect orchestration, workers, storage).
- Support multiple environments (Dev → QA → UAT → Prod) using Azure-native IaC and CI/CD (Bicep/Terraform, Azure DevOps/GitHub Actions).

## Azure Service Mapping
- **Application Hosting**: Azure App Service (Linux) or Azure Container Apps for the Next.js control plane.
- **Orchestration Runtime**: Prefect 2.x deployed to Azure Kubernetes Service (AKS) or Container Apps; alternative is Prefect Cloud with Azure agents.
- **Object Storage**: Azure Blob Storage / Data Lake Storage Gen2 containers for landing, bronze, silver, gold layers.
- **Metadata Database**: Azure Database for PostgreSQL Flexible Server (shared across environments with logical separation).
- **Secrets & Identity**: Azure Key Vault + Azure Managed Identities; SSO with Microsoft Entra ID (Azure AD).
- **Networking**: Hub-spoke VNets, Application Gateway/Front Door, private endpoints for storage/database.
- **Observability**: Azure Monitor + Log Analytics + Application Insights.

## Reference Architecture
1. **Control Plane**
   - Next.js web app container behind App Service.
   - Connects to PostgreSQL (metadata), Key Vault (secrets), Blob Storage (asset browsing), and Prefect API.
2. **Data Plane**
   - AKS cluster hosting Prefect server (optional) and worker pods.
   - Workers mount managed identity to access Blob, Synapse, SQL DBs, etc.
   - Prefect deployments configured per environment with appropriate queues and storage blocks.
3. **Perimeter**
   - Ingress via Application Gateway (WAF) or Front Door.
   - Private endpoints for storage/DB + VNet integration.

## Prerequisites
- Azure subscription with rights to provision networking, storage, compute, and identity resources.
- Base infrastructure repository (Terraform or Bicep) containing FlowForge modules.
- Container registry (Azure Container Registry) for FlowForge UI and Prefect flow images.
- CI/CD tooling (GitHub Actions or Azure DevOps).

## Deployment Steps
1. **Provision Networking & Security**
   - Create hub VNet and environment VNets; establish peering or private endpoints.
   - Deploy Azure Key Vault, configure access policies and Managed Identities.
2. **Stand Up Data Plane**
   - Provision AKS cluster (system + user node pools).
   - Deploy Prefect server (if self-hosting) using Helm or manifests; configure ingress and persistence.
   - Create Managed Identity with Blob + PostgreSQL access; assign to Prefect worker deployments.
3. **Configure Storage & Database**
   - Create Blob Storage account with containers: `landing`, `bronze`, `silver`, `gold`.
   - Deploy Azure Database for PostgreSQL; run FlowForge migrations.
   - Register storage and DB connection strings/URIs in Key Vault.
4. **Deploy Control Plane**
   - Build Next.js container with environment-specific config (App Service).
   - Configure App Service to use Managed Identity / Key Vault references for secrets.
   - Set environment variables for Prefect API URL, Blob endpoints, PostgreSQL connection, Feature flags.
5. **Register Prefect Deployments**
   - Package Prefect flows, push to container registry.
   - Use Prefect CLI (running in AKS or CI/CD) to create deployments referencing Azure Blob storage blocks.
   - Configure work queues per environment; start Prefect workers on AKS.
6. **Integrate Identity & Monitoring**
   - Enable Entra ID SSO for the web app.
   - Configure Application Insights and Log Analytics for both App Service and AKS.
7. **Promote Across Environments**
   - Use Terraform workspaces/variables or Bicep parameter files for Dev/QA/UAT/Prod.
   - Implement Azure DevOps / GitHub pipelines to deploy infrastructure, publish Docker images, run Prefect deployment updates, execute smoke tests.

## Configuration Notes
- **Storage Adapter**: Switch Node/Prefect code to Azure SDKs (`@azure/storage-blob`, `azure-storage-blob`). Environment variables define container names and account URLs.
- **Secrets Handling**: Replace `.env` with Key Vault references; use Managed Identity to retrieve secrets at runtime.
- **Networking**: If customer requires private access only, use private endpoints and integrate with on-prem via ExpressRoute/VPN.
- **Observability**: Emit custom metrics/events to Azure Monitor; use Diagnostics settings for Blob, PostgreSQL, AKS.

## Operations & Handover
- Provide runbooks for scaling AKS node pools, updating Prefect versions, rotating secrets, and applying database migrations.
- Document backup/restore strategy using Azure Backup and PostgreSQL automatic backups.
- Configure alert rules for Prefect job failures, App Service availability, storage capacity.

## Optional Integrations
- Synapse Analytics or Data Factory for heavy transformations, triggered from Prefect.
- Purview for metadata catalog sync from FlowForge.
- Logic Apps or Event Grid for event-driven triggers feeding FlowForge APIs.

## See Also
- `docs/deployment-aws.md`
- `docs/deployment-gcp.md`
- `docs/deployment-fabric.md`
- `docs/flowforge-multicloud-roadmap.md`
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/integration-partner-ecosystem.md`
