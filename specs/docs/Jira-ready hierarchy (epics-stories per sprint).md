Here’s a Jira-ready breakdown you can copy/paste into your backlog.
I’ll keep Epics aligned to sprints, with stories under each (including clear “Done when…” acceptance criteria).

You can prefix IDs however your Jira instance likes (e.g., PLAT-101); I’ll just label them logically.

Sprint 1 – Ingest Foundation
Epic S1-E1: Ingest Job Core & Landing → Bronze (MVP)
Goal: One ingest job type (file upload) going Source → Landing → Bronze, wired to UI.

Stories

S1-01: Create ingest job DB schema & TS models

Create layer_centric_ingest_jobs table with all columns (source_type, format, force_to_parquet, partitioning, etc.).

Add corresponding TypeScript types in schema.ts.

Done when: migrations run; type-safe models exist; fields are accessible via ORM/repo.

S1-02: Implement ingest job validation helper (ingest.ts)

Add TS validator (e.g., zod) that enforces:

incremental_mode=incremental → watermark_column required.

error_handling=quarantine → quarantine_path required.

schema_mode=user → non-empty user_schema.

Done when: invalid payloads are rejected with structured errors in unit tests.

S1-03: Implement ingest job CRUD API

POST/PUT/GET /api/workflows/[workflowId]/ingest-jobs.

Apply defaults:

force_to_parquet for csv/json.

partition_mode=date, partition_pattern='yyyy/MM/dd'.

error_handling='fail', compression='snappy'.

Done when: Postman/insomnia tests show ingest jobs can be created/updated and validation errors are returned correctly.

S1-04: Implement minimal ingest executor (file upload only)

For source_type=file_upload & format=csv/json:

Copy raw file to Landing.

Convert to parquet & write to Bronze (single folder, no real partitioning yet).

Done when: Running a hard-coded job ingests sample file into Landing + Bronze locations.

S1-05: Wire ingest run API for dev-inline execution

POST /api/workflows/[workflowId]/ingest-jobs/[jobId]/run:

Load job.

Validate via helper.

Execute minimal ingest executor inline (no Prefect yet).

Done when: One-click REST call successfully runs ingest and returns basic run summary.

S1-06: Create “Create Ingest Job” modal (MVP)

Support:

Name, description.

Source type: File (Upload) only.

Format: csv|json.

Convert to Parquet toggle.

Schema mode: infer (read-only).

Call ingest job API.

Done when: User can create an ingest job from the UI and see it in the pipeline detail page.

S1-07: Add ingest job listing & run button to pipeline page

List ingest jobs for workflow.

“Run” button calls run API and shows success/fail status + timestamp.

Done when: User can run ingest from UI and see basic run status contextualized on pipeline page.

Sprint 2 – Advanced Ingest (S3/Local/DB/API) + Basic DQ
Epic S2-E1: Multi-source Ingest Support
Stories

S2-01: Extend file ingest to S3 & local path

Use config.file for:

Upload handle.

s3_uri (or bucket/prefix).

Local path.

Implement Landing + Bronze write with parquet, compression, simple date partitioning.

Done when: Job with source_type=file_s3 or file_local ingests successfully into Landing & Bronze.

S2-02: Implement DB ingest support

Add config.db (connection_id, query/table_name).

Full snapshot mode (read full table or query).

Basic incremental mode using watermark_column & last_watermark_value.

Done when: Sample DB table ingested full and then incrementally with updated watermark in DB.

S2-03: Implement API ingest support

Add config.api with URL, method, headers, auth, body, pagination (page_param, page_size, next_token_path).

Implement full snapshot + basic incremental (watermark.param_name).

Done when: Test API (mock or sandbox) can be paged through and ingested to Bronze with watermark updated.

S2-04: Implement partitioning & compression in executor

Respect:

partition_mode=date|none (use ingest time for date).

partition_pattern.

compression for parquet.

Done when: Output paths reflect partitioning and files are compressed accordingly.

Epic S2-E2: Ingest DQ & Run Tracking
Stories

S2-05: Add ingest run tracking table & callbacks

Create ingest_runs table.

After each ingest run, write:

status, start_time, end_time, rows_read, rows_written, quarantined_rows, last_watermark_value.

Done when: Ingest runs are persisted and can be queried for UI.

S2-06: Implement row-level quarantine on Landing→Bronze

For rows failing parse/type/schema:

If error_handling=quarantine, write them to quarantine_path.

Track counts.

Fail job if > configurable bad-row threshold or catastrophic schema mismatch.

Done when: Intentionally corrupted data results in quarantined rows and proper status.

S2-07: Extend ingest job modal with advanced config

Add:

Source types: S3, Local, Database, API.

File CSV options.

DB connection picker & table/query fields.

API URL/method/auth/paging fields.

Partitioning UI (mode & pattern).

Compression dropdown.

Error handling + quarantine path.

Done when: All new fields map correctly to backend model and can be edited.

Sprint 3 – Unified Pipeline Orchestration
Epic S3-E1: Pipeline Orchestration & Prefect Integration
Stories

S3-01: Implement pipeline_runs table

Fields: id, workflow_id, status, start_time, end_time, duration, etc.

Done when: DB model exists and basic insert/select tested.

S3-02: Implement /workflows/[workflowId]/run endpoint

Fetch ingest jobs (& placeholder dataset jobs).

Build dependency graph.

Topologically sort:

Reference ingest jobs first (is_reference).

Other ingest jobs.

Validate:

Missing inputs.

Cycles.

Trigger Prefect flow with pipeline payload.

Done when: Endpoint returns 200 with pipeline run id, or 400 with clear validation message.

S3-03: Implement Prefect flow layer_centric_pipeline_flow.py (ingest only)

Accept payload (pipeline_id, ingest_jobs).

Execute ingest jobs in sorted order (parallel when safe).

Call back to backend to update ingest_runs and pipeline_runs.

Done when: End-to-end run from pipeline endpoint executes multiple ingest jobs in the correct order.

S3-04: Wire “Run Pipeline” button in pipeline UI

Replace/augment per-ingest run with “Run Pipeline”.

Show pipeline runs list for the workflow.

Display error messages from backend graph validation.

Done when: User can kick off a pipeline and see pipeline-level status and ingest run details.

Sprint 4 – Silver ETL (Bronze → Silver, SQL v1)
Epic S4-E1: Silver Dataset Job Definition (SQL, Single Input)
Stories

S4-01: Create dataset_jobs model for Silver layer

Fields:

id, workflow_id, layer='silver'

name, description

dataset_type (fact/dim/reference/snapshot/event_log)

grain, change_pattern

inputs JSON (one Bronze input for now)

transform_type='sql'

sql_text

target_schema, output_path, format, compression

refresh_mode (full_refresh / overwrite_partition)

Done when: Model + migration created and accessible.

S4-02: Dataset job CRUD API (Silver)

POST/PUT/GET /api/workflows/[workflowId]/silver-jobs.

Validate: at least one input, non-empty SQL & target schema.

Done when: Silver jobs can be created/updated and fetched.

S4-03: Silver job executor (SQL, one input)

In Prefect flow, after ingest:

For each Silver job:

Read Bronze input (parquet).

Execute SQL (via chosen engine).

Write Silver dataset to configured path.

Create dataset_runs table for Silver/Gold runs.

Done when: A sample Silver job successfully creates a cleaned Silver dataset from Bronze.

S4-04: “Create Silver Dataset” UI (SQL, single input)

Allow:

Name, description, dataset type, grain.

Select a Bronze input.

Enter SQL text.

Define target schema (columns, types, nullable).

Set refresh mode and partitioning.

Done when: User can define a Silver job in UI and see it run as part of pipeline.

S4-05: Display Silver jobs on pipeline page

Show list of Silver jobs, their type, refresh mode, input dataset.

Include basic run status.

Done when: Pipeline view clearly shows Bronze → Silver jobs.

Sprint 5 – Advanced Silver: Multi-source, SCD2, Conforming
Epic S5-E1: Advanced Silver Transformations
Stories

S5-01: Support multiple inputs in Silver jobs

Extend dataset_jobs model: inputs[] with dataset IDs & aliases.

Adjust SQL execution to register all inputs as tables/views.

Done when: SQL transforms can join multiple Bronze inputs.

S5-02: Implement SCD2 dimension transformation type

transform_type='scd2_dimension'.

Config fields:

business_key_columns

change_detection_columns (or hash)

effective_time_column

Output fields: effective_from, effective_to, is_current.

Implement executor to:

Compare new batch with existing dimension.

Insert new versions and close old ones.

Done when: A sample SCD2 customer_dim is created and updates correctly across runs.

S5-03: Implement conform_sources transformation type

transform_type='conform_sources'.

Config:

Multiple inputs.

Field mappings per source.

Conflict resolution (source priority or latest updated_at).

Optional source_system column.

Executor builds unified Silver table.

Done when: Multiple Bronze sources can be unified into one Silver dataset via config.

Epic S5-E2: Silver DQ (Business Rules)
Stories

S5-04: Add Silver-level DQ rules config

Extend dataset_jobs with a data_quality JSON:

Keys: not-null, uniqueness, allowed values, FK checks.

Done when: Silver job JSON can store defined rules.

S5-05: Implement Silver DQ enforcement

During Silver job run:

Apply DQ rules post-transform.

Quarantine violating rows where configured.

Fail job on contract violations (e.g., duplicate keys).

Done when: Misconfigured sample data triggers quarantines/failures as expected.

S5-06: Extend Silver UI with DQ section

Simple UI to:

Mark key columns.

Mark not-null columns.

Optional FK checks to other datasets.

Done when: Power user can define key DQ constraints for Silver datasets in UI.

Sprint 6 – Gold Layer & Use-Case Datasets
Epic S6-E1: Gold Dataset Job Types (Metrics, Marts, ML/RAG v1)
Stories

S6-01: Extend dataset_jobs to Gold layer

layer='gold'.

dataset_type:

fact_aggregate | metric_table | mart | snapshot | ml_training_set | feature_set | vector_index | export_feed.

Fields for:

grain, primary_use_case, inputs, transform_type, template configs.

Done when: Gold jobs can be stored & retrieved.

S6-02: Implement metrics_aggregate transform

Config:

Base fact (Silver).

Time grain (day/week/month/etc.).

Group dimensions.

Metric definitions (expression + optional filters).

Executor generates SQL and materializes Gold metric table.

Done when: Daily revenue-by-country table is generated from a Silver orders_fact.

S6-03: Implement snapshot/as-of transform

Config:

Base dataset (fact or SCD dim).

Snapshot grain.

As-of logic.

Executor creates point-in-time Gold snapshot table.

Done when: Sample daily customer_status snapshot is built.

S6-04: Implement ml_training_set transform (MVP)

Config:

Entity, label column/definition.

Feature sources and feature columns.

Executor joins Silver tables to produce a labeled training set.

Done when: A basic churn training set can be produced for export.

S6-05: Implement vector_index transform (RAG MVP)

Config:

Silver input.

ID + text column.

Chunk size & overlap.

Embedding model name (stub or real).

Executor:

Chunk text.

Call embedding service (or stub).

Write Gold table with chunks + embeddings + metadata.

Done when: A Gold RAG corpus table can be generated from Silver docs.

Epic S6-E2: Gold UI
Stories

S6-06: “Create Gold Dataset” UI

Support:

Identity (name, type, grain, use case).

Input selection (Silver/Gold).

Transform type (SQL, metrics_aggregate, snapshot, ML set, vector_index).

Template forms for metrics, snapshot, RAG.

Done when: User can configure & save Gold jobs from UI.

S6-07: Show Gold jobs & runs on pipeline page

Display Gold job list, type badges, and run statuses.

Done when: End-to-end Bronze→Silver→Gold DAG is visible in UI and runs via “Run Pipeline”.

Sprint 7 – Unified Data Quality Framework
Epic S7-E1: Data Quality Engine & Incidents
Stories

S7-01: Define generic DQ rules model

Introduce data_quality_rules (can still store per job if easier):

name, scope, target, check_type, condition, severity, action_on_violation, auto_fix, notification.

Done when: A generic DQ rule structure supports all layers.

S7-02: Build DQ engine

Central service that:

Picks relevant rules for a job run.

Evaluates them (SQL/DSL-based).

Produces metrics & row-level samples.

Executes defined actions (quarantine, auto-fix, fail/warn).

Done when: DQ engine can be invoked from ingest & dataset executors and return structured results.

S7-03: Implement dq_incidents table & persistence

Store per incident:

Job/dataset/run.

Rule violated.

Counts, sample rows, action taken.

Done when: DQ incidents show up in DB for test runs.

S7-04: Hook DQ engine into ingest, Silver, Gold executors

Replace ad-hoc checks with calls to DQ engine.

Enforce default policies:

Landing: detect + file quarantine only.

Bronze: structural checks + safe auto-fix/quarantine.

Silver: business DQ + canonicalization + fail on contracts.

Gold: metric DQ + fail/rollback, no silent fixes.

Done when: DQ behaviors per layer match agreed defaults.

Epic S7-E2: DQ UI
Stories

S7-05: Add DQ tab to job configuration UIs

For ingest, Silver, Gold jobs:

List configured rules.

Allow adding simple rules (not-null, uniqueness, allowed values, row count bounds).

Done when: Users can see & manage DQ rules per job.

S7-06: DQ incidents dashboard

Global view listing DQ incidents with filters.

Link through to job/dataset/run & sample data.

Done when: Stakeholders can browse recent DQ issues and drill into details.

Sprint 8 – AI Copilot & Smart Assistance
Epic S8-E1: AI Copilot Backend
Stories

S8-01: Implement AI service wrapper

Service that can:

Accept sample data and propose schemas & DQ rules.

Generate SQL from natural-language + dataset metadata.

Summarize/analyze DQ incidents/anomalies.

Done when: Service can be integration-tested with mock prompts.

S8-02: AI-assisted schema & DQ suggestion for ingest

Button in ingest creation:

Samples data.

Calls AI to suggest:

Schema.

Candidate DQ rules.

Done when: User can click “Infer schema & rules” and see suggestions pre-populated.

S8-03: AI-assisted SQL generation for Silver/Gold

Given selected inputs + text description:

AI suggests SQL for Silver or Gold job.

Done when: User can ask “build daily revenue by country from orders fact” and get a draft SQL.

S8-04: AI explanations for DQ incidents

For a given incident:

AI summarises what changed and possible causes.

Done when: Incident detail page shows AI commentary for non-trivial anomalies.

Epic S8-E2: Copilot UI
Stories

S8-05: Add AI sidebar/copilot panel

Context-aware chat:

On pipeline page, dataset page, job editors.

Support asking:

“Explain this dataset.”

“Why did this job fail?”

“Generate a Silver dim for customers.”

Done when: Power user can interact with copilot and see grounded responses referencing platform metadata.

Sprint 9 – Data Catalog, Lineage & Governance
Epic S9-E1: Catalog & Metadata
Stories

S9-01: Implement datasets catalog model

Central table(s) to store:

Dataset identity (name, layer, type).

Schema, physical paths, owner, domain.

Classification & ML-usage flag.

Populate from job definitions & run outputs.

Done when: Catalog contains all Bronze/Silver/Gold datasets.

S9-02: Build lineage graph from job dependencies

Compute DAG edges:

Ingest → Silver → Gold.

Store lineage metadata for query.

Done when: Given a dataset, upstream and downstream neighbors can be queried.

S9-03: Basic RBAC support

Roles (admin, engineer, analyst, viewer).

Guards on:

Editing jobs, connections, DQ rules.

Viewing datasets by classification level.

Done when: Permissions are enforced on key operations.

Epic S9-E2: Catalog & Lineage UI
Stories

S9-04: Catalog UI (browse/search datasets)

List with filters by layer, type, domain, owner, tags.

Dataset detail page:

Schema, sample data, metadata, classification, ML-usage.

Done when: Users can discover datasets and read their docs.

S9-05: Lineage visualization

DAG view:

Dataset detail screen showing upstream/downstream dependencies.

Done when: Users can visually see how data flows Source→Landing→Bronze→Silver→Gold→consumers.

Sprint 10 – Operations, SLAs, Scheduling & Lifecycle
Epic S10-E1: Scheduling & SLAs
Stories

S10-01: Add schedule config to workflows

Cron expression, timezone, enabled flag.

Store in DB and expose in API.

Done when: Pipeline has persisted schedule data.

S10-02: Connect schedules to orchestrator

Use Prefect or scheduler to run pipeline based on cron.

Done when: Pipelines automatically run at configured times.

S10-03: SLA config & evaluation

Per Gold dataset:

“Ready by” time.

Track SLA status per run.

Done when: SLA breaches are computed & stored.

S10-04: Alerting integration

Integrate with email/Slack/Teams.

Notify on:

Pipeline failure.

SLA breach.

Critical DQ incident.

Done when: Test notifications are delivered to configured channels.

Epic S10-E2: Lifecycle & Backfills
Stories

S10-05: Versioning of jobs & pipelines

Track job & pipeline versions on changes.

Allow viewing previous versions.

Done when: Changes are auditable and version history is visible.

S10-06: Backfill support

Allow pipeline runs with explicit date-range parameters for partitioned datasets.

Ensure idempotency and overwrite/merge semantics are clearly defined.

Done when: User can schedule a backfill for a date range and see affected datasets refreshed.

S10-07: Operations dashboard

Show:

Recent pipeline runs & statuses.

SLA adherence.

DQ incident counts.

Done when: Platform owners can see at-a-glance health and issues.