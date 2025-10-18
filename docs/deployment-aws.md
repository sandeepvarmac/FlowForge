# FlowForge Deployment Guide – AWS

## Overview
- Deploy FlowForge entirely within a customer’s AWS account, leveraging VPC networking, managed databases, and container services.
- Separate **control plane** (Next.js UI/API, metadata services) from **data plane** (Prefect orchestrator and workers).
- Support multi-environment promotion (Dev → QA → UAT → Prod) with Terraform/CloudFormation and CI/CD (GitHub Actions, AWS CodePipeline).

## AWS Service Mapping
- **Application Hosting**: AWS App Runner, ECS on Fargate, or EKS for the Next.js control plane container.
- **Orchestration Runtime**: Prefect server + workers on EKS (Fargate or EC2 nodes) or ECS; alternative is Prefect Cloud with AWS agents.
- **Object Storage**: Amazon S3 buckets for landing, bronze, silver, gold layers.
- **Metadata Database**: Amazon RDS for PostgreSQL (single or multi-AZ).
- **Secrets & Identity**: AWS Secrets Manager or Systems Manager Parameter Store; IAM roles for service accounts.
- **Networking**: Dedicated VPC with public/private subnets, NAT gateways, security groups, VPC endpoints for S3/RDS.
- **Observability**: Amazon CloudWatch Logs, Metrics, Traces (X-Ray optional).

## Reference Architecture
1. **Control Plane**
   - Next.js container on App Runner/ECS with IAM role granting access to Secrets Manager and Prefect API.
   - Connects to RDS PostgreSQL via VPC endpoint or security group rules.
2. **Data Plane**
   - EKS cluster running Prefect API (if self-hosting) and worker deployments; S3 access via IAM roles.
   - Prefect deployments configured per environment, storing artifacts in S3 prefixes.
3. **Perimeter**
   - ALB (Application Load Balancer) fronting the control plane; WAF optional.
   - Private connectivity via AWS Direct Connect/VPN as required.

## Prerequisites
- AWS account with ability to create VPC, IAM roles, EKS/ECS clusters, RDS instances, S3 buckets.
- Amazon ECR repository for FlowForge UI and Prefect flow images.
- Terraform/CloudFormation templates for FlowForge modules.

## Deployment Steps
1. **Provision Base Networking**
   - Create VPC with public/private subnets across AZs; set up Internet/NAT gateways.
   - Configure VPC endpoints for S3 and Secrets Manager to avoid public traffic.
2. **Deploy Data Plane**
   - Spin up EKS cluster (managed node groups or Fargate profiles).
   - Install Prefect server (Helm chart/manifests) if self-hosted; expose via ingress + ALB.
   - Assign IAM roles to worker pods using IRSA for S3, RDS access.
3. **Configure Storage & Database**
   - Create S3 buckets/prefixes for `landing/`, `bronze/`, `silver/`, `gold/`; enable bucket policies + encryption.
   - Provision RDS PostgreSQL (Multi-AZ for production); run FlowForge schema migrations.
   - Store connection strings and service credentials in Secrets Manager.
4. **Deploy Control Plane**
   - Build/push Next.js image to ECR.
   - Deploy via App Runner or ECS service; inject env vars via Secrets Manager (s3 bucket names, RDS URL, Prefect API URL).
   - Configure ALB/WAF, ACM certificates, Route 53 records.
5. **Register Prefect Deployments**
   - Build Prefect flow images, push to ECR.
   - Use Prefect CLI to create deployments referencing S3 blocks (`prefect_aws.s3`).
   - Start Prefect workers in EKS or take advantage of Prefect Cloud agents.
6. **Integrate Identity & Monitoring**
   - Configure Cognito or SAML/OIDC (Okta/ADFS) for FlowForge login.
   - Ship logs/metrics to CloudWatch; set alarms for run failures, API latency.
7. **Environment Promotion**
   - Parameterize Terraform/CloudFormation per environment.
   - Implement GitHub Actions / CodePipeline to apply IaC, publish Docker images, run integration tests, and trigger Prefect deployment updates.

## Configuration Notes
- **Code Changes**: Switch Node storage adapter to AWS SDK v3 (`@aws-sdk/client-s3` already in place). Ensure environment resolves bucket/role info per tenant.
- **Secrets Handling**: Use IAM roles + Secrets Manager references instead of .env files; rotate secrets through AWS Secrets Manager rotation schedules.
- **Networking**: Use security groups and NACLs to isolate control plane, data plane, and database tiers; enable TLS everywhere.
- **Observability**: Collect logs from ECS/EKS via FireLens/Fluent Bit to CloudWatch; enable X-Ray for request tracing if needed.

## Operations & Handover
- Deliver runbooks covering EKS upgrades, RDS patching, backup/restore (RDS snapshots, S3 versioning), scaling workers, rotating IAM roles.
- Configure CloudWatch alarms & SNS notifications for failures, CPU pressure, storage thresholds.
- Provide IAM least-privilege policies for DevOps, data engineers, and auditors.

## Optional Integrations
- Glue/Spark or EMR for heavy transformations triggered by Prefect.
- AWS Lake Formation for fine-grained access to S3 data lake layers.
- EventBridge and Step Functions for event-driven triggers connecting to FlowForge APIs.

## See Also
- `docs/deployment-azure.md`
- `docs/deployment-gcp.md`
- `docs/deployment-fabric.md`
- `docs/flowforge-multicloud-roadmap.md`
- `docs/integration-databricks.md`
- `docs/integration-snowflake.md`
- `docs/integration-partner-ecosystem.md`
