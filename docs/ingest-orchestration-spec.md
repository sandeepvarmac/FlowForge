# Ingest & Orchestration Specification

This document defines the unified, layer-centric ingest and pipeline orchestration model for FlowForge. It covers schema/API changes, orchestration behavior, and UI requirements to support real-world ingestion patterns while keeping a single canonical pipeline (Landing → Bronze → Silver → Gold) with simple and advanced presets.

## 1) Data Model (SQLite / schema.ts)

Extend `layer_centric_ingest_jobs` with:
- `source_type` enum: `file_upload`, `file_s3`, `file_local`, `db_query`, `api`
- `format` enum: `csv|json|parquet`
- `force_to_parquet` boolean (default true for csv/json)
- Partitioning: `partition_mode` (date|column|none), `partition_pattern` (e.g. `yyyy/MM/dd` or column name)
- `filename_pattern` (default `{timestamp}_{filename}`)
- `compression` enum: `none|gzip|snappy`
- `landing_retention_days` integer (nullable)
- `schema_mode` enum: `infer|user`; `user_schema` JSON array `{name,type}`
- `error_handling` enum: `fail|quarantine`; `quarantine_path` nullable
- `dedupe_keys` JSON array of column names
- `incremental_mode` enum: `full|incremental`; `watermark_column`; `last_watermark_value` nullable
- `rename_map` JSON object `original -> standardized`
- `is_reference` boolean
- Per-source configs (prefer `config` JSON plus key columns):
  - File: csv_options (delimiter, header, encoding, quote)
  - DB: `connection_id`, `query`, `table_name`
  - API: `url`, `method`, `headers`, `auth`, `body`, paging (`page_param`, `page_size`, `next_token_path`), `watermark_param`

Keep ingest run table as-is; no change required.

## 2) API Changes

`apps/web/src/app/api/workflows/[workflowId]/ingest-jobs/route.ts`
- Accept all new fields; validate:
  - incremental_mode=incremental → require watermark_column
  - error_handling=quarantine → require quarantine_path
  - schema_mode=user → require user_schema entries
- Defaults: force_to_parquet=true for csv/json; partition_mode=date with pattern `yyyy/MM/dd`; error_handling=fail
- Persist rename_map, dedupe_keys, compression, partitioning, filename_pattern, landing_retention_days, is_reference, incremental settings.

`apps/web/src/app/api/workflows/[workflowId]/ingest-jobs/[jobId]/run/route.ts`
- Include full config in payload to orchestrator.
- Reject missing watermark when incremental; reject unsupported combos.

`apps/web/src/app/api/workflows/[workflowId]/run/route.ts`
- Fetch ingest + dataset jobs; include ingest configs in flow payload.
- Topo-sort ingest (reference first) → silver → gold; validate dependencies; return 400 on missing inputs/cycles.
- Trigger Prefect deployment (unified pipeline); keep inline fallback for dev only.

Optional: add TS validator helper `apps/web/src/lib/validation/ingest.ts` to encapsulate rules.

## 3) Orchestration (Prefect Flow)

`prefect-flows/layer_centric_pipeline_flow.py` (unified pipeline flow)
- Inputs: pipeline_id, ingest jobs (full config), dataset jobs.
- Order: ingest (refs first) → silver → gold; validate readiness.
- Ingest execution:
  - File/S3/local: read, convert to parquet if force_to_parquet; apply compression; write to landing (raw) + bronze (parquet) with partitioning and filename pattern.
  - DB: run query/table copy; apply watermark predicate if incremental; write parquet to bronze; update watermark.
  - API: fetch (with paging); apply watermark param if incremental; write parquet to bronze.
  - Apply schema_mode: infer or cast to user_schema; apply rename_map; dedupe on dedupe_keys.
  - Error handling: quarantine bad rows if set; else fail.
  - Landing retention: optional cleanup task for older-than-N days.
- Dataset jobs (silver/gold):
  - Assume parquet inputs; or use provided format flag if not forced.
  - Respect dependency ordering and fail if inputs not ready.
  - Write parquet to silver/gold; update catalog (path, schema, parent_tables).
- Callbacks: POST/PATCH back to backend run endpoints for ingest runs, dataset runs, and pipeline run (status, start/end, duration, row counts, output keys, watermark updates).

Deploy as `layer-centric-pipeline` (or renamed unified) and point backend trigger to it.

## 4) UI Changes

`apps/web/src/components/layer-centric/create-ingest-job-modal.tsx`
- Fields:
  - Source type: File (upload/S3/local), DB query, API.
  - Format selector; “Convert to Parquet” toggle.
  - Partitioning: mode (date/column/none), pattern/column input.
  - Filename pattern (default `{timestamp}_{filename}`).
  - Compression dropdown.
  - Landing retention (days).
  - Schema mode: infer vs user schema table editor.
  - Error handling: fail vs quarantine; quarantine path.
  - Rename map editor (key/value rows).
  - Dedupe keys multi-select.
  - Incremental toggle: incremental vs full; watermark column; show last watermark value (readonly).
  - Reference dataset toggle.
- File-specific: csv options; upload/S3/local path inputs.
- DB-specific: connection picker, query/table input, optional watermark column.
- API-specific: URL/method, headers/auth/body, paging (page_param, page_size, next_token_path), watermark param name/value path.
- Keep feature flag gating.

`apps/web/src/app/(routes)/pipelines/[id]/page.tsx`
- Show ingest badges: source_type, format→parquet, partitioning, incremental, reference flag.
- Show configured paths/prefixes and last run status.
- “Run Pipeline” uses unified run endpoint; surface validation errors.

`apps/web/src/app/(routes)/pipelines/page.tsx`
- Ensure all timestamps use safe formatters; avoid RangeErrors.

## 5) Storage/Format Alignment

- Bronze outputs: parquet by default; keep landing raw. Ensure silver/gold readers can assume parquet unless a format flag says otherwise.
- Set content-type/extension to match format.

## 6) Validation Rules (summary)

- incremental_mode=incremental → watermark_column required.
- error_handling=quarantine → quarantine_path required.
- schema_mode=user → user_schema required.
- Partitioning: validate pattern/column names.
- Reject unknown source_type/format combos; default force_to_parquet on csv/json.
