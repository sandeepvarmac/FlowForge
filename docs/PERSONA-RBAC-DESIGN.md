# FlowForge Persona-Based Access Control (RBAC/ABAC) – Design Brainstorm

## Goals
- Enable persona-based access to all FlowForge capabilities with least privilege.
- Control who can: run workflows, create/edit workflows/jobs/triggers, manage environments/teams, browse data, manage secrets, and administer the platform.
- Support multi-environment and team isolation already present in the codebase.
- Provide a clear path from MVP → enterprise governance without blocking current usage.

## Scope
- Application surface: Next.js web app API routes in `apps/web/src/app/api/**`.
- Data plane: S3/MinIO object access via SDKs; DuckDB analytics outputs; Prefect/Orchestrator triggers (to be replaced by cloud-native later).
- Persistence: Current SQLite schema (migratable to Postgres/Azure SQL later).

## Personas (Initial Set)
- Platform Admin: Full system administration, break-glass, tenancy, security, and billing.
- Practice/Delivery Director: Owns environments/teams, sets policy, approves production changes.
- Data Platform Admin: Manages infrastructure integrations, work pools, deployments, secrets.
- Workspace/Project Owner: Owns a workspace (team/project), can manage members/roles within scope.
- Data Engineer: Creates/edits workflows, jobs, transforms; manages schedules and triggers within scope.
- Analytics Engineer: Defines Gold models, schema, metrics; can publish datasets and data browser views within scope.
- Data Analyst/BI Analyst: Runs workflows (non‑prod or approved prod), browses data (Gold/Silver), exports with limits.
- Citizen Developer (Power User): Can build simple workflows in dev/qa; cannot alter prod without approval.
- Viewer/Stakeholder: Read-only to dashboards, workflow status, execution logs (masked).
- Auditor/Compliance: Read-only to configurations and full audit trail; no execution or edits.
- Support/Operator (NOC/SRE): Can cancel/retry runs, view logs/metrics; cannot edit workflows.
- External Partner (Optional): Restricted, time-bound, resource-scoped access; no data export by default.

## Permission Catalog (Actions)
- Workflow lifecycle
  - workflow.read, workflow.create, workflow.edit, workflow.delete
  - workflow.run (env-scoped), workflow.cancel, workflow.retry
  - workflow.promote (dev→qa→uat→prod), workflow.approve_change (change control)
- Job/trigger management
  - job.read, job.create, job.edit, job.delete
  - trigger.read, trigger.create, trigger.edit, trigger.delete, trigger.enable, trigger.disable
- Environment/team governance
  - environment.read, environment.manage
  - team.read, team.manage, membership.manage
  - quota.manage (concurrency, runtime, storage)
- Data browser and datasets
  - data.browser.view (layer: bronze|silver|gold)
  - data.browser.query (filters, row limits)
  - data.export (destinations: file|s3|snowflake), export.limit.manage
  - catalog.read, catalog.register, catalog.edit
  - policy.mask.apply, policy.mask.manage (column masking), rls.manage (row-level)
- Secrets and connections
  - secret.read (scoped), secret.create, secret.rotate, secret.delete
  - connection.read, connection.manage
- Platform ops/security
  - rbac.role.assign, rbac.role.manage, rbac.custom_role.manage
  - audit.read, audit.export
  - settings.read, settings.manage

## Scoping Dimensions
- Environment: production, uat, qa, development (exists in workflows table/migrations).
- Team: team column (renamed from business_unit), plus workspace/project identifiers.
- Resource: workflow, job, dataset/table, trigger, secret, connection.
- Data: layer (bronze/silver/gold), dataset tags (PII, restricted), column-level sensitivity, RLS predicates.
- Time-bound grants: start/end validity for temporary elevation.

## Role → Permission Mapping (Proposed Defaults)
- Platform Admin
  - All permissions on all scopes; break-glass bypass; manage roles/tenancy/secrets.
- Practice/Delivery Director
  - environment.manage, team.manage, rbac.role.assign (within org scope), approve_change, quota.manage; data export policy manage.
- Data Platform Admin
  - connection.manage, secret.manage, deployments/workers/manage, settings.manage; no unrestricted data export.
- Workspace/Project Owner
  - Full workflow/job/trigger CRUD within workspace; membership.manage; promote within non‑prod; request prod approvals.
- Data Engineer
  - workflow/job/trigger CRUD within scope; run in non‑prod; propose prod changes; limited secret.read.
- Analytics Engineer
  - catalog.register/edit; gold publish; browser.view silver/gold; limited exports; propose schema changes.
- Data Analyst/BI Analyst
  - browser.view gold (default), silver optional; run workflows in non‑prod or approved prod runs; exports capped.
- Citizen Developer
  - Create simple workflows in dev/qa; no prod; no secrets manage; exports disabled by default.
- Support/Operator
  - run.cancel/retry; read executions/logs/metrics; no edit of definitions.
- Viewer
  - read-only: workflows, executions, dashboards; no data export.
- Auditor
  - audit.read/export, config read; no run or edit.
- External Partner
  - Minimal read within shared workspace; no exports; time-bound.

## RBAC/ABAC Model
- RBAC: roles are bundles of permissions.
- ABAC: resource checks incorporate attributes (environment, team, dataset tags).
- Inheritance: Platform Admin > Org Admin (Practice Director) > Workspace Owner > Engineer/Analyst.
- Custom roles: allow admin-defined bundles with additive permissions; deny rules reserved for platform.

## Enforcement Strategy
- Central Authorizer module
  - Inputs: user identity (JWT claims/session), roles, scope (env/team/workspace), resource, action, attributes.
  - Fast checks in API routes before DB operations.
- API changes
  - Middleware to attach identity and computed grants to request.
  - Consistent helpers: `can(user, action, resource, scope)`.
  - Deny by default; explicit allow via role+scope; mask or filter response when partial access.
- Data-level controls
  - Column masking based on dataset policies and role; implement in data browser queries.
  - Row-level predicates applied in query builder for browser (and in Athena/Snowflake adapters later).

## UI Behavior
- Contextual visibility: hide or disable actions the user cannot perform.
- Scope switchers: environment/team workspace selector with only authorized scopes.
- Clear affordances: approvals required indicators for prod runs/changes.
- Audit surfaces: who changed what, when; role membership view.

## Database Schema Additions (SQLite now, RDS later)
- users(id, email, name, status, created_at, updated_at)
- roles(id, name, description, system_role boolean, created_at, updated_at)
- permissions(id, name, description)
- role_permissions(role_id, permission_id)
- groups/teams(id, name, description)
- user_roles(user_id, role_id, scope_type, scope_id, environment, team, valid_from, valid_to)
- policies(id, type [mask|rls|export], dataset, column, rule, tags, created_by, created_at)
- audits(id, actor_user_id, action, resource_type, resource_id, details, created_at)

Notes
- Leverage existing workflows(environment, team) columns and indexes.
- For MVP, store policies at dataset/column level with simple JSON rules.

## API/Route Touchpoints (Examples)
- Workflows
  - POST/PUT/DELETE: require workflow.create/edit/delete and scope checks.
  - POST run: require workflow.run for the target env/team; if prod, require approval or director override.
- Jobs/Triggers
  - CRUD requires corresponding permissions; enable/disable gated to engineer/owner/admin.
- Executions
  - GET includes only workflows visible to user; logs masked for restricted columns.
- Data Browser
  - GET list/catalog filters by dataset visibility; query applies column masking and row predicates; enforce row limits and export caps.
- Secrets/Connections
  - Only admins/platform roles can read/manage; redact in responses; audit every access.
- RBAC Admin
  - Endpoints to list roles, assign roles, create custom roles; protected by rbac.* permissions.

## Data Browser Controls
- Layer access: Gold default; Silver opt‑in; Bronze restricted.
- Row limit and query timeout per persona; pagination tokenization.
- Export controls: per‑role caps and destinations; watermarking/tagging; require approval for large exports.
- Sensitive data
  - Column masks by default for PII/Sensitive tags; explicit unmask grants in secure workspaces only; audit unmask events.

## Approvals & Change Control
- Draft → Review → Approve → Promote to environment.
- Required approvals for prod changes/runs configurable by team/criticality.
- Store approval records (who approved, when, what changed).

## Auditing & Compliance
- Log: auth events, role changes, permission grants, secret reads, workflow CRUD, run start/stop, data exports.
- Tamper‑evident: write audit trail to append‑only table and optionally offload to object storage.
- Reports: monthly role diff, export events, prod change approvals, failed access attempts.

## Multi‑Tenancy Options
- Single tenant with workspaces (teams) and scoped RBAC (default).
- Hard tenancy: workspace_id foreign key on resources; enforce in all queries; allow org admins to span.

## Migration Plan (MVP → Enterprise)
- MVP (Phase 1)
  - Seed roles, permissions, and a small authorizer; gate run/create/edit and data browser by layer.
  - Add basic RBAC admin UI; add audit logging for role assignments and workflow CRUD.
- Phase 2
  - Add approvals/change control and environment promotion gates.
  - Add column masking rules and export caps; implement policy table.
- Phase 3
  - Add RLS predicates and custom roles; integrate with cloud identity (OIDC, SSO, SCIM).

## Implementation Effort (Estimate)
- Phase 1 (core RBAC + gates + audits): 1–2 weeks
- Phase 2 (approvals + masking + exports): 1–2 weeks
- Phase 3 (RLS + custom roles + SSO): 2–3 weeks

## Open Questions
- Identity source: email/password vs. SSO only? Need JWT claims mapping.
- Self‑service role requests and approval workflows?
- Time‑limited elevation automation and reminders?
- Impersonation for support (audited, time‑boxed)?
- Data browser engine evolution (Athena/Snowflake) and policy portability?

## Next Steps
- Confirm persona list and default role mappings.
- Approve Phase 1 scope and seed permissions.
- I can draft a skeletal schema migration and authorizer middleware for early review (SQLite first, Postgres‑ready).

