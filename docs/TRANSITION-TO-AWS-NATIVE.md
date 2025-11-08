# FlowForge Migration Guide: Full Transition to AWS Native Services

## 1) Objectives
- Replace all local and third‑party infra with AWS‑native services.
- Preserve user experience and workflow semantics (Bronze → Silver → Gold).
- Improve security, observability, and scalability with managed services.

## 2) Current State (Key Points)
- App: Next.js 14 app in `apps/web` with API routes; metadata in SQLite (`apps/web/src/lib/db`).
- Orchestration: Prefect 2 flows in `prefect-flows` triggered via REST from the app.
- Storage: MinIO S3‑compatible bucket, accessed by Node SDK and boto3.
- Local infra: Docker Compose for MinIO + Postgres + Prefect Server (dev).

## 3) Target AWS Architecture (High Level)
- Object storage: Amazon S3 (KMS encryption, lifecycle, access logs).
- Orchestration: AWS Step Functions; scheduling via Amazon EventBridge.
- Compute: AWS Lambda (small/medium tasks) and/or Amazon ECS Fargate (containers). Optional AWS Glue for larger transforms.
- App hosting: ECS Fargate behind an ALB (or AWS Amplify for static parts).
- App metadata DB: Amazon RDS for PostgreSQL.
- Secrets/config: AWS Secrets Manager and AWS Systems Manager Parameter Store.
- Observability: Amazon CloudWatch Logs, Metrics, Alarms; optional AWS X‑Ray.
- Triggers/async: Amazon SQS/SNS + EventBridge.
- Data catalog/query (optional but recommended): AWS Glue Data Catalog + Amazon Athena; optional Iceberg + Lake Formation.
- Network/security: VPC (private subnets + NAT), S3 VPC endpoints, SGs, KMS.

## 4) Service Mapping
- MinIO → Amazon S3
- Prefect Server UI/API → AWS Step Functions (State Machine console) + EventBridge
- Prefect Workers → ECS Fargate services or Lambda
- SQLite (better‑sqlite3) → Amazon RDS for PostgreSQL
- .env secrets → Secrets Manager / SSM
- Docker Compose runtime → ECS Fargate/ECR/ALB
- Logs on stdout/Prefect → CloudWatch Logs + Alarms

## 5) Phased Migration Plan (Step by Step)

### Phase 0: Landing Zone and Foundations (Day 0–1)
1. Create AWS accounts or use existing; set up VPC with 2–3 AZs, private subnets, NAT, S3 gateway endpoint, and public subnets for ALB.
2. Provision KMS keys for S3, RDS, and Secrets Manager.
3. Create ECR repos for web app and data compute images.
4. Decide compute strategy for transforms: Lambda for small files (<1–2 GB, <15 min), ECS for larger/longer; Glue for Spark scale.

Deliverables:
- Terraform/CDK stacks for VPC, KMS, ECR.

### Phase 1: Storage Migration (MinIO → S3) (0.5–1 day)
1. Create S3 bucket (e.g., `flowforge-data-prod`) with default encryption (SSE‑KMS) and lifecycle rules.
2. Update web env: set `S3_BUCKET_NAME`, remove custom MinIO endpoint.
   - File: `apps/web/src/lib/storage/index.ts` — use default AWS endpoint and ensure `forcePathStyle` is disabled for AWS.
3. Update Python flows settings to use AWS endpoint/region and rely on IAM (no static keys).
   - File: `prefect-flows/utils/config.py`.
4. Validate upload/list/read paths and Bronze/Silver/Gold keys are unchanged.

Acceptance:
- Upload from UI writes to S3 landing path; listing works; parquet artifacts appear in S3.

### Phase 2: Orchestration (Prefect → Step Functions + EventBridge) (2–4 weeks)
1. Model the current DAG (Bronze → Silver → Gold) as a Step Functions state machine:
   - Tasks call Lambda/ECS jobs for `bronze_ingest`, `silver_transform`, `gold_publish`.
   - Use `Catch` and `Retry` blocks to mirror Prefect resiliency.
2. Implement compute units:
   - Lambda: Package Python with polars/parquet via a container image, or use ECS tasks with a shared Python image.
   - ECS: Containerize `prefect-flows` tasks into a data‑worker image; parametrize entrypoint by job type.
3. Scheduling:
   - EventBridge rules for cron/interval triggers targeting the state machine.
4. Replace Prefect calls in the app API:
   - `apps/web/src/app/api/workflows/[workflowId]/run/route.ts`: swap Prefect create_flow_run with `StartExecution` (SFN). Map workflow/job params to input JSON.
   - `apps/web/src/app/api/workflows/[workflowId]/executions/route.ts`: poll `DescribeExecution` and `GetExecutionHistory`; translate states to existing app statuses.
5. Dependency triggers:
   - Replace Prefect‑based completion callbacks with EventBridge/SNS: publish an event at workflow completion; rules start downstream state machines.

Acceptance:
- A workflow run from the UI starts a Step Functions execution and shows progress/status in the executions view.

### Phase 3: Application DB (SQLite → RDS for PostgreSQL) (1–2 weeks)
1. Provision RDS PostgreSQL (Multi‑AZ in prod) and Secrets Manager credential.
2. Add a DB layer for Postgres; replace direct better‑sqlite3 usage.
   - Files: `apps/web/src/lib/db/*` — replace `Database` initialization, SCHEMA, and raw SQL with node‑postgres (pg) or an ORM (Prisma/Drizzle) with migrations.
3. Migrate schema/data from SQLite to Postgres; write one‑time migration scripts.
4. Update all API routes that use `getDatabase()` to async DB access.

Acceptance:
- App starts using RDS; CRUD and workflow execution lifecycles work; no local DB file is used.

### Phase 4: Compute Packaging (2–5 days)
1. ECS path (recommended for simplicity):
   - Build a `data-worker` image with Python, polars, boto3; push to ECR.
   - Create ECS task definition with task role for S3.
   - Step Functions tasks invoke ECS RunTask with parameters (landing_key, primary_keys, etc.).
2. Lambda path (if small files):
   - Use container‑image Lambda with polars; create one function per step or a single function with a `step` parameter.

Acceptance:
- Bronze/Silver/Gold tasks run headless from Step Functions and read/write S3.

### Phase 5: Secrets & Config (0.5–1 day)
1. Move OPENAI, DB creds, and any API tokens into Secrets Manager.
2. Reference secrets in ECS task definitions and Lambda environment through IAM.

Acceptance:
- No static secrets in .env on the instances/containers.

### Phase 6: Observability (1–2 days)
1. Configure ECS/Lambda logs to CloudWatch Logs; create log groups and retention.
2. Add CloudWatch alarms for error rates, 5xx on ALB, Step Functions failures.
3. Optionally enable X‑Ray for tracing.

Acceptance:
- Centralized logs and basic alarms in place.

### Phase 7: Web App Hosting (2–4 days)
1. Containerize Next.js app; push to ECR.
2. Create ECS Fargate service behind an ALB; map `/api` routes; set env from Secrets/SSM.
3. Short‑term: if Phase 3 is not completed, mount EFS for `./data` (SQLite) as a bridge.
4. Long‑term: use RDS only; remove EFS.

Acceptance:
- App accessible via ALB; runs without local volumes.

### Phase 8: Scheduling & Triggers (3–5 days)
1. EventBridge cron rules per environment/team to start state machines.
2. SQS/SNS for fan‑out or manual retries; add DLQs for failure handling.
3. Replace any Prefect‑specific deployment IDs with Step Functions ARNs mapped by env/team.

Acceptance:
- Time‑based and dependency‑based runs start via EventBridge/SQS.

### Phase 9: Catalog & Query (Glue/Athena) (4–7 days)
1. Register Bronze/Silver/Gold datasets in AWS Glue Data Catalog.
2. Optionally adopt Iceberg/Lake Formation for schema evolution and governance.
3. Expose query access via Athena and add cost controls.
4. Update `gold_publish` to register/update tables/partitions where applicable.

Acceptance:
- Datasets queryable in Athena; tables tracked in Glue.

### Phase 10: Security & Networking (2–4 days)
1. Lock down S3 with bucket policies, VPC endpoints, and KMS.
2. Use least‑privilege IAM roles for ECS/Lambda/Step Functions.
3. Add WAF on ALB as needed; enforce TLS.

### Phase 11: CI/CD & IaC (1–2 weeks)
1. Author Terraform/CDK for all above components with workspaces for `dev/qa/uat/prod`.
2. Configure GitHub Actions (or CodePipeline) to build/push images and deploy stacks.
3. Bake smoke tests after deploy.

### Phase 12: Cutover & Rollback (1–2 days)
1. Run side‑by‑side for a subset of workflows; compare outputs and metrics.
2. Switch traffic/DNS to ECS ALB; retire local stack.
3. Keep rollback plan: revert ALB target group; disable EventBridge rules.

## 6) Effort by Element (Guidance)
- S3 migration: XS (0.5–1 day)
- Orchestration (Prefect → Step Functions): L–XL (2–4 weeks)
- App DB (SQLite → RDS): M–L (1–2 weeks)
- Compute packaging (ECS/Lambda): S–M (2–5 days)
- Secrets (Secrets Manager/SSM): XS–S (0.5–1 day)
- Observability (CloudWatch): S (1–2 days)
- Scheduling/Triggers (EventBridge/SQS): M (3–5 days)
- Web hosting (ECS/ALB): S–M (2–4 days)
- IaC/CI‑CD: M–L (1–2 weeks)
- Catalog/Query (Glue/Athena): M (4–7 days)

## 7) Risks & Mitigations
- Data volume exceeds Lambda limits → Use ECS or Glue.
- SQLite coupling in code → Prioritize RDS migration; interim EFS mount.
- Prefect UI loss → Build minimal status UI from Step Functions APIs; use CloudWatch dashboards.
- Secrets sprawl → Centralize in Secrets Manager; IAM boundary policies.

## 8) Acceptance Criteria (End‑State)
- All uploads and artifacts reside in S3 with KMS.
- Workflows run via Step Functions; executions observable via app and AWS console.
- App persists metadata to RDS; no local DB.
- Secrets managed by Secrets Manager/SSM; IAM roles used for AWS access.
- Logs and metrics centralized in CloudWatch; alarms on failures.

## 9) Code Change Cheat‑Sheet
- Replace Prefect calls in:
  - `apps/web/src/app/api/workflows/[workflowId]/run/route.ts`
  - `apps/web/src/app/api/workflows/[workflowId]/executions/route.ts`
- Remove Windows‑specific Python spawn; do S3 pattern match in Node or inside compute step.
- Swap SQLite layer in `apps/web/src/lib/db` to Postgres client; refactor API routes to async DB.
- Storage SDKs already S3‑compatible; drop custom endpoint for AWS.

