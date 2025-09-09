# Enterprise Data Platform (EDP) — Product Brief

## Vision
Build a modern, distinct, and intuitive data platform that ingests from diverse sources, validates and transforms data across Bronze/Silver/Gold layers on a data lake, and exposes governed, query‑ready tables (Iceberg) to analytics engines — with reliability, observability, and self‑service at its core.

## Primary Users
- Data engineers: Configure sources, transformations, validations, and schedules.
- Data analysts/scientists: Discover, query, and monitor curated datasets.
- Ops/support: Monitor runs, troubleshoot failures, manage access.
- Admins: Govern roles, environments, and platform configuration.

## Key Capabilities (from extracted Product.pdf)
- Workflows & Jobs: Visual orchestration; file‑based and SQL‑based jobs; retries/reruns.
- Three Layers: Bronze (raw, all versions), Silver (validated/deduped), Gold (analytics; Iceberg).
- Sources: CSV/Excel, APIs (e.g., MailChimp, SharePoint, etc.), RDBMS (SQL Server, Oracle, Postgres, Snowflake).
- Transformations: Mapping/renaming/partitioning, derived fields, lookups/joins; optional Python post‑processing.
- Scheduling & Execution: Manual runs and schedules (EventBridge‑style); multi‑job workflows.
- Incremental Loads: Watermark columns, parameterized queries, stored procedures.
- Validation & Reconciliation: Config‑driven checks; logs to CloudWatch/S3‑style audit; notifications.
- Security & Access: Role‑based (Admin, RW, Execute, RO); scoped by BU/app.
- Monitoring & Observability: Step‑by‑step run timeline, metrics, errors, DQ outcomes, dashboard.
- Interoperability: Iceberg tables consumable by Athena/Snowflake/Trino; configs in object storage; secrets in a vault.

## Goals
- Reliability first: ACID tables (Iceberg), clear failures, quick reruns.
- Portability: Engine‑agnostic design; IaC; avoid deep vendor lock‑in.
- Usability: Guided wizards plus expert mode; strong defaults with advanced controls.
- Governance: Lineage, audit logs, RBAC, consistent environments.

## Non‑Goals (initially)
- Re‑creating identical legacy UI or color scheme.
- Covering every niche source/connector on day one.
- Complex ML/BI authoring in‑app (we focus on reliable data delivery).

## Success Metrics
- Time to onboard a dataset (target: hours → minutes with templates).
- Run reliability (success rate, MTTR).
- User adoption and task completion without documentation.
- Query performance and cost efficiency on Gold tables.

