# Feature Parity Checklist

## Core
- [ ] Workflows (create/edit/delete)
- [ ] Jobs: file‑based ingest
- [ ] Jobs: SQL‑based ingest (table/query)
- [ ] Transformations: mapping/rename/derived/partition
- [ ] Validations: basic rules + results
- [ ] Reconciliation (multi‑file)
- [ ] Post‑processing hook (script)

## Scheduling & Execution
- [ ] Manual run
- [ ] Scheduled runs
- [ ] Retry/rerun from step

## Data Model & Storage
- [ ] Bronze/Silver/Gold layers
- [ ] Iceberg tables for Gold
- [ ] Schema and partition evolution support

## Security & Governance
- [ ] RBAC: Admin, Read‑Write, Execute, Read‑Only
- [ ] Scoped by BU/application
- [ ] Audit logs for changes and runs

## Monitoring & Observability
- [ ] Run timeline with step metrics
- [ ] Logs (structured + raw)
- [ ] DQ/validation results surfacing
- [ ] Execution dashboard with KPIs

## Integrations
- [ ] Athena/Trino/Snowflake access helpers
- [ ] Secrets in vault (abstraction layer)
- [ ] Configs in object storage layout

