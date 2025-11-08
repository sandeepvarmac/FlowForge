# FlowForge Migration Guide: Full Transition to Azure Native Services

## 1) Objectives
- Replace local/third‑party infra with Azure‑native services while preserving UX and workflow semantics.
- Achieve managed operations, enterprise security, and multi‑environment deployments.

## 2) Current State (Key Points)
- App: Next.js 14 app with API routes; metadata in SQLite.
- Orchestration: Prefect flows and REST triggers.
- Storage: MinIO S3‑compatible bucket.
- Local dev via Docker Compose.

## 3) Target Azure Architecture (High Level)
- Object storage: Azure Blob Storage (ADLS Gen2) with RBAC and SSE.
- Orchestration/Scheduling: Azure Data Factory (ADF) pipelines and triggers, or Azure Logic Apps for light flows; Event Grid for events.
- Compute: Azure Functions (Durable Functions for orchestrations) or Azure Container Apps/AKS for containers; ADF activities or Synapse/Serverless SQL for large transforms.
- App hosting: Azure App Service (Linux) or Azure Container Apps (ACA) for the Next.js app.
- App metadata DB: Azure SQL Database (PaaS) or Cosmos DB (if going NoSQL).
- Secrets/config: Azure Key Vault + App Config.
- Observability: Azure Monitor, Log Analytics, Application Insights.
- Triggers/async: Event Grid, Service Bus/Storage Queues.
- Data catalog/query (recommended): Microsoft Purview Data Catalog + Azure Synapse Serverless SQL.
- Network/security: VNets, Private Endpoints, Managed Identities, Defender for Cloud.

## 4) Service Mapping
- MinIO → Azure Blob Storage (ADLS Gen2)
- Prefect Server/Workers → ADF + Triggers (or Durable Functions) + Container Apps/AKS workers
- SQLite → Azure SQL Database (or Cosmos DB)
- .env secrets → Azure Key Vault (and Azure App Configuration)
- Docker Compose runtime → Azure Container Apps or App Service; images in Azure Container Registry (ACR)
- Logs on stdout/Prefect → Azure Monitor / Log Analytics / App Insights

## 5) Phased Migration Plan (Step by Step)

### Phase 0: Foundations (Day 0–1)
1. Resource group per environment (dev/qa/uat/prod).
2. Virtual Networks with subnets for ACA/App Service and private endpoints for Blob/SQL/Key Vault.
3. Provision Key Vault and App Configuration; enable RBAC and purge protection.
4. Create ACR repositories for web and data images.

Deliverables:
- Bicep/Terraform stacks for RG, VNet, ACR, Key Vault, App Config.

### Phase 1: Storage Migration (MinIO → Azure Blob/ADLS) (1–2 days)
1. Create a Storage Account with hierarchical namespace (ADLS Gen2) and encryption.
2. Migrate bucket layout to containers/prefixes: `landing/`, `bronze/`, `silver/`, `gold/`.
3. Implement Azure Blob adapters in code:
   - Web (Node): add an `AzureBlobStorageService` implementing `IStorageService` and replace `@aws-sdk/client-s3` usage where configured.
     - Files: `apps/web/src/lib/storage/storage-service.ts` (add provider), new `apps/web/src/lib/storage/azure-blob.ts`.
   - Python: add Azure storage client and funcs mirroring `prefect-flows/utils/s3.py`.
     - Files: new `prefect-flows/utils/azure_blob.py`; update settings in `prefect-flows/utils/config.py` to allow `storage_provider=azure`.
4. Use Managed Identity for access from ACA/App Service/Functions.

Acceptance:
- Upload/list from UI and tasks write/read from Blob; Bronze/Silver/Gold artifacts land under expected prefixes.

### Phase 2: Orchestration (Prefect → ADF/Durable) (2–4 weeks)
Option A – Azure Data Factory (recommended for data pipelines)
1. Create ADF pipelines for Bronze → Silver → Gold with activities calling Functions/Container Apps.
2. Configure ADF triggers (schedule, tumbling window) and parameters (workflow/job IDs, landing path, keys).
3. Implement dependency chaining via ADF pipelines or Event Grid events between pipelines.

Option B – Durable Functions (code‑first orchestration)
1. Implement an orchestrator function with activity functions for bronze/silver/gold.
2. Use Durable timers/retries and external events for dependency triggers.

Replace Prefect in App API
1. `apps/web/src/app/api/workflows/[workflowId]/run/route.ts`:
   - Replace Prefect REST with ADF `CreatePipelineRun` (or Durable `start` HTTP trigger), passing parameters.
2. `apps/web/src/app/api/workflows/[workflowId]/executions/route.ts`:
   - Poll ADF run status/Activity runs (or Durable status endpoint) and map to app statuses.

Acceptance:
- UI starts ADF/Durable executions; status and logs are visible via API calls.

### Phase 3: Application DB (SQLite → Azure SQL Database) (1–2 weeks)
1. Provision Azure SQL Database with Private Endpoint and AAD auth.
2. Replace SQLite code paths with an Azure SQL client/ORM; port schema/migrations.
   - Files: `apps/web/src/lib/db/*`.
3. Write data migration scripts from SQLite to SQL Database.
4. Run integration tests; remove local DB dependency.

Acceptance:
- App uses Azure SQL; CRUD and executions work; no local DB file.

### Phase 4: Compute Packaging (2–5 days)
Option A – Azure Container Apps (general‑purpose)
1. Build a `data-worker` image; push to ACR.
2. ACA jobs or revisions execute bronze/silver/gold with params; ADF/Logic Apps invoke ACA jobs via REST/managed identity.

Option B – Azure Functions (serverless)
1. Implement Python Functions for bronze/silver/gold; package polars/parquet via custom container or extensions bundle.
2. Call Functions from ADF activities or Durable orchestrator.

Acceptance:
- Bronze/Silver/Gold run via ACA jobs or Functions and handle S3→Blob changes transparently through adapter.

### Phase 5: Secrets & Config (0.5–1 day)
1. Store secrets in Key Vault; wire to App Service/ACA/Functions via Managed Identity and Key Vault references.
2. Put non‑secret config in App Configuration.

Acceptance:
- No secrets in .env; rotation via Key Vault works.

### Phase 6: Observability (1–2 days)
1. Enable Application Insights for the web app and Functions.
2. Route container stdout to Log Analytics; create workbooks and alerts (failure rates, latency, errors).

Acceptance:
- Centralized logs/metrics with basic alerts in Azure Monitor.

### Phase 7: Web App Hosting (2–4 days)
1. Containerize Next.js and deploy to Azure App Service (Linux) or Azure Container Apps.
2. Use Managed Identity, Key Vault references, and private endpoints.
3. Short‑term: if DB migration lags, mount Azure Files as an interim volume for SQLite (not recommended beyond pilots).

Acceptance:
- App reachable over HTTPS; uses Key Vault and Azure SQL.

### Phase 8: Scheduling & Triggers (3–5 days)
1. ADF triggers for scheduled runs; Event Grid to orchestrate downstream pipelines on completion.
2. Service Bus queues for decoupled fan‑out and DLQs.
3. Replace “deployment IDs” with Pipeline IDs or Resource IDs per env/team.

Acceptance:
- Time‑based and dependency‑based runs start via ADF/Event Grid/Service Bus.

### Phase 9: Catalog & Query (Purview/Synapse) (4–7 days)
1. Register datasets in Microsoft Purview; configure scans for Blob containers.
2. Expose query access via Synapse Serverless SQL; optionally define external tables.
3. Update gold step to register/update schemas/partitions as needed.

Acceptance:
- Datasets discoverable in Purview; queryable via Synapse Serverless.

### Phase 10: Security & Networking (2–4 days)
1. Use Private Endpoints for Blob, SQL, and Key Vault; restrict public network access.
2. Enforce RBAC and Managed Identities; least‑privilege for data plane.
3. Defender for Cloud policies; WAF on Front Door/App Gateway if internet‑facing.

### Phase 11: CI/CD & IaC (1–2 weeks)
1. Author Bicep/Terraform for all components across environments.
2. GitHub Actions/Azure DevOps pipelines to build images, push to ACR, and deploy infra/apps.
3. Blue/green or rolling strategy for the web app.

### Phase 12: Cutover & Rollback (1–2 days)
1. Parallel runs for representative workflows; validate outputs vs. baseline.
2. Switch DNS/traffic to new app; disable legacy triggers.
3. Rollback plan: swap back endpoints; pause triggers.

## 6) Effort by Element
- Blob migration and adapters: S–M (2–4 days)
- Orchestration (ADF/Durable): L–XL (2–4 weeks)
- App DB (SQLite → Azure SQL): M–L (1–2 weeks)
- Compute packaging (ACA/Functions): S–M (2–5 days)
- Secrets (Key Vault/App Config): XS–S (0.5–1 day)
- Observability (Monitor/App Insights): S (1–2 days)
- Scheduling/triggers (ADF/Event Grid/Service Bus): M (3–5 days)
- Web hosting (App Service/ACA): S–M (2–4 days)
- IaC/CI‑CD: M–L (1–2 weeks)
- Catalog/Query (Purview/Synapse): M (4–7 days)

## 7) Risks & Mitigations
- SDK changes (S3 → Blob) → Introduce storage abstraction layer and implement Azure adapter.
- SQLite coupling → Prioritize Azure SQL migration; interim Azure Files only for pilots.
- Prefect UI replacement → Use ADF monitoring/UI or Durable Functions status APIs; add minimal status pages.
- Networking complexity → Use Private Endpoints and Managed Identities to simplify secret management.

## 8) Acceptance Criteria (End‑State)
- All artifacts stored in Blob/ADLS with encryption and RBAC.
- Workflows run via ADF/Durable; visible in app via Azure APIs.
- App uses Azure SQL; secrets in Key Vault; no local DB.
- Logs/metrics centralized with alerts in Azure Monitor/App Insights.

## 9) Code Change Cheat‑Sheet
- Add Azure Blob storage adapter and switch provider via config in:
  - `apps/web/src/lib/storage/storage-service.ts` (new provider).
  - `apps/web/src/lib/storage/*` (new `azure-blob.ts`).
  - `prefect-flows/utils/azure_blob.py` and settings in `utils/config.py`.
- Replace Prefect API calls with ADF/Durable API calls in:
  - `apps/web/src/app/api/workflows/[workflowId]/run/route.ts`
  - `apps/web/src/app/api/workflows/[workflowId]/executions/route.ts`
- Replace SQLite in `apps/web/src/lib/db` with Azure SQL client/ORM and async routes.

