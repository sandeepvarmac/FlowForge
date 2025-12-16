Here’s a sprint-by-sprint implementation plan that:

Respects everything we’ve discussed so far (ingest, Bronze/Silver/Gold, DQ, AI, governance, etc.).

Delivers quick wins early and then layers in sophistication.

Assumes ~2-week sprints and a small cross-functional squad (BE, FE, Data/ML, DevOps).

You can scale up/down by merging or splitting sprints, but the order of work is important.

Phase 0 – Framing (you can do this in parallel with Sprint 1)
Very light but important:

Confirm core stack: SQLite/Postgres, Node/Next, Prefect, object storage, etc.

Agree on naming: pipelines = workflows, ingest jobs, dataset jobs (silver/gold), DQ rules.

Decide sprint length and team allocation.

I’ll start proper from Sprint 1.

Sprint 1 – Core ingest foundation & first quick win
Goal: Have a single unified ingest job pipeline working end-to-end for the simplest case: file upload → Landing → Bronze parquet with minimal config and UI.

Scope
Backend / data model

Implement DB migration for layer_centric_ingest_jobs with all fields from your spec (even if not all used yet):

source_type, format, force_to_parquet

partitioning (partition_mode, partition_pattern)

filename_pattern, compression

landing_retention_days

schema_mode, user_schema

error_handling, quarantine_path

dedupe_keys

incremental_mode, watermark_column, last_watermark_value

rename_map, is_reference

config JSON (file/db/api sub-configs)

Add TypeScript types (SourceType, IngestFormat, IngestConfig, etc.) to schema.ts.

API

Implement POST/PUT /api/workflows/[workflowId]/ingest-jobs:

Accept all fields.

Implement validation rules (or zod schema) for:

incremental_mode=incremental → watermark_column required.

error_handling=quarantine → quarantine_path required.

schema_mode=user → user_schema required.

Set sensible defaults:

force_to_parquet = true for csv/json when not provided.

partition_mode = 'date', partition_pattern = 'yyyy/MM/dd' by default.

error_handling = 'fail', compression = 'snappy'.

Implement dev-only inline run for POST /api/workflows/[workflowId]/ingest-jobs/[jobId]/run:

For now, support only:

source_type = file_upload

format = csv/json

Do a simple:

Copy raw file to Landing.

Convert to parquet → Bronze (no partitioning yet or just a simple dt=ingest_date).

Prefect (orchestration stub)

Create a minimal layer_centric_pipeline_flow.py that can execute only ingest jobs:

Accept pipeline_id, ingest_jobs.

For now: one ingest job, sequential; no dataset jobs.

Wire run endpoint to call this Prefect flow or inline fallback based on env flag.

UI

create-ingest-job-modal.tsx – MVP:

Minimal fields:

Name / description.

Source type: File (Upload) only.

Format: csv/json.

“Convert to Parquet” toggle (defaults ON).

Basic schema mode: infer only.

Save via new ingest-jobs API.

pipelines/[id]/page.tsx:

List ingest jobs.

Per-job “Run” button calling /ingest-jobs/[jobId]/run.

Show last run status and timestamp (dummy values at first).

Quick win at end of Sprint 1

A power user can:

Create a pipeline.

Define a file upload ingest job.

Upload data and see it appear as Landing + Bronze parquet.

Trigger ingest from the UI and see a “success/failed” status.

Sprint 2 – Full ingest power: S3/local, DB, API, partitioning, DQ basics
Goal: Make ingest usable in the real world for multiple source types and configs, with basic DQ and partitioning.

Scope
Backend / ingest execution

Extend ingest executor (Prefect flow + inline dev fallback) to support:

File/S3/local:

Use config.file with:

Local path / upload handle.

s3_uri / bucket+prefix.

CSV options (delimiter, header, encoding, quote).

Implement:

Landing raw write (preserve original).

Bronze parquet write with:

force_to_parquet

compression

partition_mode + partition_pattern (date-based using ingest time to start).

DB sources:

config.db with:

connection_id, query or table_name.

Implement:

Full snapshot mode.

Basic incremental mode by watermark_column, using last_watermark_value if present.

API sources:

config.api with:

URL, method, headers, auth, body.

Pagination: page_param, page_size, next_token_path.

Implement:

Full snapshot API data load.

Basic incremental with watermark.param_name.

Implement incremental_mode semantics in executor:

For incremental jobs: apply filter predicate based on watermark_column / API param.

Update last_watermark_value from max watermark in each run.

DQ basics in ingest

Implement row-level quarantine during Landing→Bronze:

Rows that fail type/parse rules go to quarantine_path when error_handling=quarantine.

Track counts: rows_read, rows_written, quarantined_rows.

Fail job when:

Schema is completely incompatible (e.g., missing required columns).

X% rows invalid (configurable global or per-job later).

Callbacks

Augment ingest-jobs/[jobId]/run flow:

After orchestration finishes, update an ingest_runs table (if not present, create):

status, start_time, end_time, rows_read, rows_written, quarantined_rows, last_watermark_value.

UI

Enhance create-ingest-job-modal.tsx:

Add source types:

File (S3), File (Local path), Database, API.

Show relevant config sections per source type:

File: CSV options; path/URI.

DB: connection picker, table/query.

API: URL, method, auth, paging basics.

Partitioning fields:

Mode: date|none (column-mode later).

Compression dropdown.

Error handling: fail | quarantine, quarantine_path.

Ingest job badges on pipelines/[id]/page.tsx:

Show source_type, format→parquet, partitioning, incremental vs full.

Quick win at end of Sprint 2

Platform supports ingest from:

Uploaded files, S3/local files, a DB table, or an API.

Data lands in Landing & Bronze with basic DQ.

Incremental loads for DB/API are functional.

Sprint 3 – Unified pipeline orchestration & reference datasets
Goal: Move from “run ingest job” to “run the whole pipeline”, including ingest ordering and reference datasets.

Scope
Backend

Implement POST /api/workflows/[workflowId]/run:

Fetch ingest jobs + dataset jobs (even if dataset jobs are empty in this sprint).

Build graph and perform topological sort:

Ingest jobs first.

is_reference = true ingests before others.

(Silver & Gold jobs will be included later).

Validate:

Missing inputs.

Cycles.

Trigger Prefect deployment layer-centric-pipeline with:

pipeline_id

sorted ingest jobs as a list

(dataset jobs placeholder array).

Extend Prefect flow layer_centric_pipeline_flow.py:

Accept pipeline run payload.

Run ingest jobs according to topo order, in parallel where possible.

For each job:

Call ingest task.

Call backend callback endpoint to update ingest_run and pipeline_run.

Implement pipeline_runs table:

id, workflow_id, status, start_time, end_time, duration, etc.

UI

pipelines/[id]/page.tsx:

Replace per-ingest “Run” with “Run Pipeline” button.

Show latest pipeline runs with status and timestamps.

Show inline errors if run endpoint returns 400 due to graph issues.

pipelines/page.tsx:

Show pipeline list with last run status.

Use safe date formatting to avoid RangeErrors.

Quick win at end of Sprint 3

User can press Run Pipeline and orchestrator:

Orders ingest jobs correctly.

Runs them with tracking of pipeline-level status.

Reference ingest jobs run first.

Sprint 4 – Silver dataset jobs (Bronze → Silver, v1)
Goal: Introduce Silver jobs with the simplest and broadest pattern: single-source SQL transformation to create clean fact/dim/ref tables.

Scope
Backend / model

Add silver_dataset_jobs (or generic dataset_jobs with layer='silver') table with fields:

id, workflow_id, name, description

layer='silver'

dataset_type: fact | dimension | reference | snapshot | event_log | feature_set?

grain (free text)

change_pattern: append_only | upsert | full_refresh

inputs: JSON (list of upstream dataset names/ids + aliases, initially one bronze input).

transform_type = 'sql'

sql_text

target_schema: JSON (columns, types, nullable, description)

refresh_mode: full_refresh or overwrite_partition (by date)

partitioning, output_path, format, compression

Basic data_quality JSON placeholder for future DQ rules.

Create APIs:

POST/PUT /api/workflows/[workflowId]/silver-jobs

Include validation for:

At least one input.

Valid SQL (shallow parse if possible).

Target schema non-empty.

Orchestration

Extend layer_centric_pipeline_flow.py:

Accept dataset_jobs with layer info.

After ingest jobs:

Run Silver jobs in topo order based on input dependencies (for now, only bronze dependencies).

Silver job execution:

Read from Bronze (parquet).

Execute SQL transformation (via warehouse engine or Execution engine).

Write to Silver path with same format/parquet.

Update dataset_runs table (status, row counts, etc.).

UI

“Create Silver Dataset” modal/page:

Identity:

Name, description, dataset type, grain.

Input:

Select a single Bronze dataset.

Transform:

SQL editor with basic autocomplete (optional) or plain textarea.

Output:

Target schema editor (table of columns).

Partitioning (date/none).

Refresh mode: full_refresh vs overwrite_partition.

On pipeline page:

Show Silver job list under ingest jobs.

Show job badges:

Type (fact/dim/ref).

Refresh mode.

Input dataset(s).

Quick win at end of Sprint 4

User can:

Configure a Silver dataset from a Bronze table using SQL.

Run the pipeline and see Bronze then Silver tables materialize.

You now have a usable Bronze→Silver system for basic transformations.

Sprint 5 – Silver advanced: multi-source, SCDs, conforming
Goal: Make Silver powerful enough for realistic modeling: multi-source conforming, SCD1/2 dimensions, better DQ hooks.

Scope
Backend

Extend Silver job model to support:

Multiple inputs (inputs[] with dataset IDs + aliases).

Transformation templates:

transform_type: sql | scd2_dimension | conform_sources.

Implement SCD2 dimension template:

Config:

business_key_columns

change_detection_columns or hash column

effective_time_column

Output SCD columns names (effective_from, effective_to, is_current)

Executor:

Compare new batch vs existing Silver.

Insert new rows, set end dates/flags for changed rows.

Implement conform_sources template:

Config:

multiple inputs

column mappings per source

source priority or “latest updated_at wins”

optional source_system column.

Executor: unify multiple Bronze sources into one Silver table.

DQ at Silver

Implement basic business-rule DQ:

Not-null on key columns.

Uniqueness constraints on grain keys.

Referential checks (Silver facts referencing dims).

Config-driven:

Extend data_quality JSON for Silver jobs to store these simple rules.

Silver job execution now:

Applies DQ checks after transformation.

Quarantines failing rows where configured, or fails job.

UI

Expand “Create Silver Dataset” modal:

Add “transformation type” selector:

SQL (existing).

SCD2 Dimension.

Conform multiple sources.

For SCD2:

Wizard to choose key columns, change columns, effective time.

For conforming:

Pick multiple inputs, define field mappings per source.

Add basic DQ section/tab:

Define primary key.

Define required columns.

Optionally define simple referential checks (FK to another Silver/Gold).

Quick win at end of Sprint 5

Silver can now:

Build SCD2 dims.

Conform multiple sources into one entity.

Enforce simple business contracts via DQ (keys, nullability, FKs).

Sprint 6 – Gold dataset jobs: metrics, marts, ML/RAG v1
Goal: Introduce Gold jobs for metrics, marts, ML sets, and basic RAG corpora, so platform is end-to-end usable.

Scope
Backend / model

Add gold_dataset_jobs (or dataset_jobs[layer='gold']) with fields for:

dataset_type:

fact_aggregate | metric_table | mart | snapshot | ml_training_set | feature_set | vector_index | export_feed.

grain, primary_use_case (BI, ML, RAG, export), inputs, transform_type, sql_text or template config.

Target schema, partitioning, output path.

refresh_mode, refresh_window.

Gold-level data_quality JSON (metric thresholds etc.).

Implement transformation types:

sql for general usage.

metrics_aggregate template (group by dims + metric definitions).

snapshot template (as-of tables).

ml_training_set template (simplified: join Silver tables to produce label + features).

vector_index template (for RAG):

Basic config:

Input Silver dataset.

Text column, ID column.

Chunk size & overlap.

Embedding model name (just a string placeholder for now).

Output table with text + embedding column (embedding generation stubbed or integrated with an embedding service).

Orchestration

Extend pipeline flow:

After Silver jobs, run Gold jobs in topo order.

Gold job executor:

SQL or template-based.

Write to Gold path.

Update dataset_runs and pipeline_run statuses.

Gold DQ basics

Implement:

Metric-level checks:

“No negative revenue.”

“Row count per day > threshold.”

Optionally simple % change checks vs previous run.

Actions:

For now: fail job (and pipeline) on critical metric DQ failure.

UI

“Create Gold Dataset” modal:

Identity:

Name, description, dataset type, grain, use case.

Inputs:

Select Silver (and possibly other Gold) datasets.

Transform:

Choose transformation type:

SQL, metrics aggregate, snapshot, ML training set, RAG/vector index (MVP).

For metrics:

Fact source, time grain, dimensions, metrics definitions.

For ML training:

Base entity & label column, basic feature selection from Silver tables.

For vector index:

Text column, chunk parameters, embedding model name.

Output:

Target schema, partitioning, refresh mode.

Pipeline page:

Show Gold section under Silver.

Show layer ordering and basic lineage (Bronze→Silver→Gold).

Quick win at end of Sprint 6

You have a fully usable Bronze→Silver→Gold pipeline:

Ingest from real sources.

Silver modeling with SCDs & conforming.

Gold metrics tables, marts, ML training sets, basic RAG corpora.

This is your first real “product-ready” milestone.

Sprint 7 – Unified Data Quality framework (rules, quarantine, incidents)
Goal: Take DQ from scattered checks to a unified, configurable framework across ingest, Silver, and Gold.

Scope
Backend / model

Create a generic data_quality_rules model (even if stored as JSON per job):

name, scope (ingest/silver/gold), target (dataset/column/metric), check_type, condition (expression/JSON), severity, action_on_violation, auto_fix (optional), notification.

Implement DQ engine:

For each job run:

Evaluate rules relevant to that job & layer.

Produce DQ results:

Row-level: list of failing rows (if configured).

Aggregate: counts, rates, metrics.

Actions:

Apply quarantine (to dedicated quarantine datasets).

Apply auto-fixes where defined.

Fail or warn based on severity.

Create dq_incidents table:

Link to job, dataset, run, rule.

Store metrics, samples, and “what action was taken”.

DQ behaviors by layer (formalize what we discussed)

Implement defaults:

Landing: file-level DQ, no auto-fix.

Bronze: structural/type DQ, safe auto-fix + row quarantine.

Silver: business DQ, canonicalization + targeted quarantine/fail.

Gold: metric DQ, fail or rollback, no silent “fixes” beyond maybe dropping partial partitions.

UI

Add a “Data Quality” tab for:

Ingest jobs.

Silver jobs.

Gold jobs.

In that tab:

List configured rules.

Allow adding simple rules via form:

Not-null, allowed values, ranges, uniqueness, row count bounds, etc.

Add a DQ incidents view:

Global page listing incidents by dataset/job/run.

Quick drill-down into samples of failing rows.

Quick win at end of Sprint 7

Users can:

Configure DQ rules per job & layer.

See DQ incidents and quarantine data.

Have consistent DQ behavior across the entire pipeline.

Sprint 8 – AI-powered assistance: schema, SQL, and DQ suggestions
Goal: Start delivering on the “AI-powered, no-code, power-user friendly” promise.

Scope
AI assist services

Implement an internal “AI copilot” service (can speak to an LLM API) that can:

Given a sample of data:

Suggest schema (field names, types).

Suggest not-null, uniqueness, allowed values.

Given metadata + a natural-language prompt:

Generate SQL for Silver or Gold transformations.

Given DQ incidents or anomalies:

Generate explanations & remediation suggestions.

Integrations

In Create Ingest Job flow:

“Infer schema & DQ rules from sample” button:

Sample data.

AI suggests:

Column types.

Candidate rules (e.g., pattern for country_code, non-null keys).

In Create Silver/Gold Dataset flows:

“Let AI draft SQL for me”:

User describes desired dataset in NL.

AI generates SQL using selected inputs.

“Suggest DQ rules”:

Based on sample Silver/Gold data.

For DQ incidents:

For anomalous metrics:

AI provides:

“What changed?”

Hypotheses (e.g., a new segment appeared, upstream volume dropped).

UI

Add an AI sidebar / copilot panel:

On pipeline and dataset config pages:

Chat UX where user can ask:

“Show me all Silver datasets using customer_id.”

“Explain why Gold.daily_revenue dropped yesterday.”

“Generate an SCD2 dimension from this Bronze table.”

Quick win at end of Sprint 8

Power users can:

Use AI to bootstrap ingest schemas, SQL, and DQ rules.

Get explanations for DQ issues and anomalies.

Start to build reasonably complex pipelines in a semi-no-code, AI-assisted way.

Sprint 9 – Governance, catalog, and lineage
Goal: Layer in enterprise governance: catalog, lineage, ownership, classification, ML-usage flags.

Scope
Backend / catalog

Create datasets metadata table (or reuse dataset jobs with richer metadata) that stores:

Technical info:

Layer (bronze, silver, gold).

Physical path, format, schema.

Business metadata:

Name, description, tags, domain, owner.

Classification:

PII/PHI/financial, etc.

Usage flags:

“Allowed for ML training” yes/no.

Build lineage graph:

From job dependencies:

Ingest → Silver → Gold.

Optionally link to external assets (dashboards, models) later.

RBAC/permissions (basic)

Implement roles:

Admin, Data Engineer, Data Analyst, Viewer.

Gate:

Editing jobs, DQ rules, connections.

Viewing PII-tagged datasets, etc.

UI

Add catalog view:

Searchable list of datasets.

Filters by layer, type, domain, owner, tags.

Dataset detail page:

Schema, sample data (if allowed).

Owner, description, tags, classification, ML-usage flag.

Lineage diagram (simple DAG view).

Integrate governance fields:

In job creation/edit flows:

Owner, domain, classification, tags, ML-safety flag.

Quick win at end of Sprint 9

You now look and feel like a proper enterprise platform:

Central catalog.

Lineage across layers.

Ownership & sensitivity metadata.

Sprint 10 – Operations, SLAs, scheduling, lifecycle
Goal: Make the platform robust in production: scheduling, SLAs, monitoring, basic lifecycle management.

Scope
Scheduling & triggers

Add schedule config to pipelines:

Cron expressions.

Timezone.

Enable/disable flag.

Event trigger skeleton:

Stub for “trigger on new file” or “after pipeline X” (even if implemented simply via Prefect).

SLAs & monitoring

Define SLA fields per Gold dataset:

“Ready by” time.

Max allowed latency.

Implement:

SLA evaluation per run.

Alerting hooks:

Email/Slack/Teams integration.

Observability:

Aggregate metrics:

Run counts, success/fail rates, average duration.

DQ violation rates.

Simple dashboards (even if internal).

Lifecycle & backfills (MVP)

Support:

Backfill runs:

Date-range-based for pipelines with date partitioning.

Version tracking:

At least version numbers for jobs and pipelines.

Rollback:

Restore previous pipeline/job version from history.

UI

In pipeline detail:

Schedule editor.

SLA settings for key datasets (especially Gold).

Backfill runner (choose date range; show estimated cost/impact if possible).

Ops view:

“Health” page showing:

Current failing pipelines.

SLAs at risk.

Recent DQ incidents.

Quick win at end of Sprint 10

Platform can run on a schedule, with basic SLAs and backfills.

You have enough operational visibility to trust it in production for real workloads.

Post–Sprint 10: Extension epics (high-level)
To truly round out the AI platform story (beyond what we’ve already discussed):

Feature Store & ML Ops:

Strong semantics for feature sets (online/offline parity, point-in-time correctness).

Model registry and training/evaluation workflows.

Deeper RAG & LLM tooling:

Prompt templates, evaluation datasets, safety policies, and LLM monitoring.

Extensibility/integrations:

dbt integration, BI semantic models, external schedulers, etc.

Config-as-code & GitOps for pipelines.