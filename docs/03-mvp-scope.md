# MVP Scope

## In-Scope (Phase 1)
- Workflows: create/edit; 1–3 jobs per workflow; manual run; rerun from failed step.
- Job types: File ingest (CSV from S3 path or upload), SQL ingest (SQL Server via connection), basic transform, validation.
- Transformations: Column mapping/rename, simple derived fields, partition selection.
- Validation: Row counts and basic rules (null checks, range checks) with severity and notifications placeholder.
- Monitoring: Run timeline, step durations, record counts, logs, error surface; runs list with filters.
- Data Catalog: Gold tables listing with schema preview and sample rows (using Iceberg on S3 + Athena/Trino adapter or mock for Phase 1).
- Security: RBAC (Admin, Read‑Write, Execute, Read‑Only) scoped by BU.
- Config: Store workflow/job config in object storage‑like layout; secrets in a vault abstraction.

## Near‑Term (Phase 2)
- Scheduling: Attach schedules (cron UI), calendar, blackout windows.
- Reconciliation: Multi‑file checks with results in run UI.
- Post‑Processing: Hook to run scripts (e.g., PDF/Excel exporters) after jobs complete.
- Incremental loads: Watermark config UI; parameterized SQL; stored procedure support.
- Lineage: Visual lineage from source → tables; impacted objects on change.
- Catalog integrations: Glue Catalog/Purview adapters, data governance policies.

## Out‑of‑Scope (Initial)
- Complex UI for every external source/connector.
- Built‑in BI/dashboarding; we provide connection helpers instead.

## Success Criteria (MVP)
- Onboard a CSV and a SQL Server table, transform to Gold, and query samples from the catalog screen.
- Observe a failed validation, fix config, rerun from failed step, verify success.
- RBAC prevents a Read‑Only user from editing workflows.

