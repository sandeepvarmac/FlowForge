# Information Architecture & Navigation

## Global Navigation
- Home / Dashboard
- Workflows
- Data Sources
- Transformations
- Schedules
- Monitoring
- Data Catalog
- Admin

## Sitemap (first pass)
- Dashboard
  - KPI tiles (runs, failures, DQ violations)
  - Recent activity and alerts
  - Quick actions (create workflow, new source)
- Workflows
  - List (filters: owner, BU, status)
  - Detail
    - Canvas (jobs graph) + properties side panel
    - Runs tab (history, durations, outcomes)
    - Config tab (parameters, environment overrides)
    - Schedule tab (attach schedules)
- Data Sources
  - List (type, env, last used)
  - New/Edit (file, SQL, API; credentials, sampling, schema)
- Transformations
  - Mapping designer (columns, types, expressions)
  - Lookup/Join builder (reference datasets)
  - Preview on sample data
- Schedules
  - Calendar + list view
  - Triggers (cron, event‑based), blackout windows
- Monitoring
  - Runs (filters, search)
  - Run detail timeline (Source → Bronze → Silver → Gold)
  - Logs, metrics, DQ results, rerun from step
- Data Catalog
  - Tables (Bronze/Silver/Gold)
  - Schema, sample rows, partitions/versions
  - Lineage (upstream jobs, downstream usage)
  - Connect (Athena/Snowflake/Trino snippets)
- Admin
  - Users & roles
  - Environments
  - Secrets and connections
  - Audit & change history

