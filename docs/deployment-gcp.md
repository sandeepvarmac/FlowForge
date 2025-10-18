# FlowForge Deployment Guide – Google Cloud Platform

## Overview
- Deploy FlowForge within a customer’s GCP project, using Google-native services for networking, storage, identity, and monitoring.
- Maintain separation between **control plane** (Next.js UI/API) and **data plane** (Prefect orchestration, workers).
- Support Dev → QA → UAT → Prod via Terraform/Deployment Manager and Cloud Build/GitHub Actions.

## GCP Service Mapping
- **Application Hosting**: Google Cloud Run (fully managed) or Google Kubernetes Engine (GKE) for the Next.js control plane container.
- **Orchestration Runtime**: Prefect server + workers on GKE (Autopilot or Standard); alternative is Prefect Cloud with GCP agents.
- **Object Storage**: Google Cloud Storage buckets for landing, bronze, silver, gold layers.
- **Metadata Database**: Cloud SQL for PostgreSQL.
- **Secrets & Identity**: Secret Manager + Service Accounts; Cloud IAM for role assignments.
- **Networking**: VPC with private service access, serverless VPC connectors, load balancers.
- **Observability**: Cloud Logging, Cloud Monitoring, Error Reporting, Cloud Trace.

## Reference Architecture
1. **Control Plane**
   - Container deployed to Cloud Run or GKE behind an HTTPS load balancer.
   - Uses Secret Manager for configuration, Cloud SQL via private IP, GCS for storage browsing, Prefect API endpoint for orchestration.
2. **Data Plane**
   - GKE cluster running Prefect API (if self-hosted) and deployment/agent pods.
   - Workloads use Workload Identity to access GCS, BigQuery, Cloud SQL.
3. **Perimeter**
   - External HTTPS load balancer with Cloud Armor policies; optional private service connect for internal-only access.

## Prerequisites
- GCP project with IAM roles for networking, compute, storage, and database provisioning.
- Artifact Registry repositories for FlowForge UI and Prefect flow images.
- Terraform/Deployment Manager stack for infrastructure automation.

## Deployment Steps
1. **Provision VPC & Security**
   - Create VPC, subnets, Cloud NAT, and firewall rules.
   - Enable private service access for Cloud SQL and configure serverless VPC connector (if using Cloud Run).
2. **Deploy Data Plane**
   - Create GKE cluster (Autopilot or Standard).
   - Install Prefect server (optional) via Helm; expose through Internal/External HTTPS load balancer.
   - Configure Workload Identity for Prefect workers; grant IAM roles for GCS, Cloud SQL client, Pub/Sub (if needed).
3. **Configure Storage & Database**
   - Create GCS buckets with prefixes for `landing/`, `bronze/`, `silver/`, `gold/`; enable uniform bucket-level access and CMEK if required.
   - Provision Cloud SQL for PostgreSQL (high availability); run FlowForge schema migrations.
   - Store credentials and connection info in Secret Manager; allow service accounts to access them.
4. **Deploy Control Plane**
   - Build Next.js image and push to Artifact Registry.
   - Deploy to Cloud Run (with VPC connector) or to GKE (Deployment + Ingress); set environment variables for Prefect API, GCS buckets, Cloud SQL.
   - Integrate Cloud SQL Auth proxy or private IP connectors for database access.
5. **Register Prefect Deployments**
   - Package Prefect flows, push to Artifact Registry.
   - Use Prefect CLI to create deployments referencing `prefect_gcp.cloud_storage` blocks.
   - Run workers on GKE using Workload Identity; scale via HPA or Autopilot.
6. **Integrate Identity & Monitoring**
   - Implement Identity-Aware Proxy (IAP) or Cloud Identity / OAuth for SSO into FlowForge.
   - Configure Cloud Logging & Monitoring dashboards; set alerting policies for failures, latency, and capacity.
7. **Environment Promotion**
   - Parameterize Terraform/Deployment Manager for each environment.
   - Use Cloud Build/GitHub Actions pipelines to apply infrastructure, deploy containers, update Prefect deployments, run smoke tests, and promote artifacts.

## Configuration Notes
- **SDK Adjustments**: Update Node and Python storage adapters to use `@google-cloud/storage` and `google-cloud-storage`; set bucket URLs via env vars.
   - Continue to support S3-compatible endpoints for local MinIO development.
- **Secrets Handling**: Replace local `.env` usage with Secret Manager (accessed via service accounts/Workload Identity).
- **Networking**: Use Private Service Connect and serverless VPC connectors to keep traffic private; configure firewall rules carefully for Cloud SQL and GKE.
- **Observability**: Centralize logs in Cloud Logging; set up alert policies for Prefect flow failures and App errors.

## Operations & Handover
- Provide procedures for GKE upgrades, Cloud SQL maintenance, backup/restore (automated backups, PITR), rotating service account keys (prefer keyless Workload Identity).
- Configure Cloud Monitoring dashboards and alerting to email/SMS/Pub/Sub.
- Document scaling policies (Cloud Run revisions, GKE node pools) and cost controls (budgets, alerts).

## Optional Integrations
- BigQuery, Dataproc, or Dataflow jobs triggered from Prefect for heavy analytics.
- Dataplex or Data Catalog synchronization for metadata governance.
- Pub/Sub or Eventarc for event-driven triggers into FlowForge.

## See Also
- `docs/deployment-azure.md`
- `docs/deployment-aws.md`
- `docs/deployment-fabric.md`
- `docs/flowforge-multicloud-roadmap.md`
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/integration-partner-ecosystem.md`
