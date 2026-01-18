# FlowForge Database Setup Guide

## Overview

FlowForge uses SQLite for metadata storage. The database is automatically initialized when the application starts, but you can also manually create it.

## Database Location

By default, the database is created at:
```
apps/web/data/flowforge.db
```

You can override this with the `DATABASE_PATH` environment variable.

## Quick Start (Recommended)

**Option A: Let the app create it automatically**
```bash
cd apps/web
npm run dev
```
The app will auto-create and initialize the database on first run.

**Option B: Create fresh database manually**
```bash
cd apps/web

# Create data directory
mkdir data          # Windows: md data

# IMPORTANT: Delete any existing database first!
del data\flowforge.db   # Windows
rm data/flowforge.db    # Mac/Linux

# Create fresh database
sqlite3 data/flowforge.db < ../../scripts/init-database.sql
```

## IMPORTANT: Fresh Database Required

The `init-database.sql` script is for **fresh databases only**. If you get errors like:
```
Parse error: no such column: pipeline_id
Parse error: no such column: source_id
```

This means you have an **existing database with old schema**. Solutions:

1. **Delete the old database** and run the script again:
   ```bash
   del apps\web\data\flowforge.db   # Windows
   rm apps/web/data/flowforge.db    # Mac/Linux
   sqlite3 apps/web/data/flowforge.db < scripts/init-database.sql
   ```

2. **Or let the app auto-migrate**: Just run `npm run dev` - the app will automatically migrate old schema to new schema.

## Schema Files

- **Schema Definition**: `apps/web/src/lib/db/schema.ts` - TypeScript schema exported as SQL string
- **Init Script**: `scripts/init-database.sql` - Standalone SQL file for manual initialization
- **DB Module**: `apps/web/src/lib/db/index.ts` - Database connection and migration logic

## Tables Overview

| Table | Description |
|-------|-------------|
| `database_connections` | Reusable database connection configurations |
| `storage_connections` | File/storage connections (S3, local, SFTP, etc.) |
| `pipelines` | Data pipeline definitions (containers for sources) |
| `pipeline_triggers` | Schedule and dependency triggers for pipelines |
| `sources` | Individual data ingestion tasks within pipelines |
| `executions` | Pipeline execution history |
| `source_executions` | Individual source execution records |
| `dq_rules` | Data quality rule definitions |
| `dq_rule_executions` | Data quality rule execution results |
| `dq_quarantine` | Records that failed quality checks |
| `reconciliation_rules` | Data reconciliation rule definitions |
| `reconciliation_executions` | Reconciliation execution results |
| `metadata_catalog` | Data catalog for bronze/silver/gold layers |
| `ai_schema_analysis` | Cache for AI-generated schema analysis |
| `audit_log` | System audit trail |

## Terminology

The codebase uses the following terminology:

| Current Term | Former Term | Description |
|--------------|-------------|-------------|
| Pipeline | Workflow | Container for related data sources |
| Source | Job | Individual data ingestion task |
| Source Execution | Job Execution | Record of a source run |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_PATH` | `./data/flowforge.db` | Path to SQLite database |
| `SQLITE_JOURNAL_MODE` | `WAL` | SQLite journal mode (WAL, DELETE, etc.) |

## Migrations

Migrations are handled automatically in `apps/web/src/lib/db/index.ts`. When the app starts, it checks for:

1. Missing columns and adds them
2. Table renames (workflows → pipelines, jobs → sources)
3. Index updates

## Troubleshooting

### Database is locked
If you see "database is locked" errors, ensure no other process is accessing the database. You can change the journal mode:
```bash
export SQLITE_JOURNAL_MODE=DELETE
```

### Missing tables
If tables are missing, the app should create them automatically. If not, run the init script manually:
```bash
sqlite3 apps/web/data/flowforge.db < scripts/init-database.sql
```

### Schema mismatch
If you have an old database with legacy table names (workflows, jobs), the app will automatically migrate them on startup.
