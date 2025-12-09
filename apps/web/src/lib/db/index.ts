import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import { SCHEMA } from './schema'

export const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'flowforge.db')

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Create or open database
let db: Database.Database | null = null

// Alias for backward compatibility
export const getDb = () => getDatabase()

export function getDatabase(): Database.Database {
  if (!db) {
    console.log('???  Initializing SQLite database at:', DB_PATH)
    db = new Database(DB_PATH)

    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Allow overriding journal mode for compatibility with shared volumes
    const journalMode = (process.env.SQLITE_JOURNAL_MODE || 'WAL').toUpperCase()
    db.pragma(`journal_mode = ${journalMode}`)

    // Initialize schema
    db.exec(SCHEMA)

    runMigrations(db)

    console.log('? Database initialized successfully')
  }

  return db
}

function runMigrations(database: Database.Database) {
  try {
    // Migration 1: Add flow_run_id to source_executions (formerly job_executions)
    // First check if the table exists with new name
    const sourceExecTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='source_executions'").all()

    if (sourceExecTable.length > 0) {
      const sourceExecColumns = database.prepare('PRAGMA table_info(source_executions)').all() as Array<{ name: string }>
      const hasFlowRunId = sourceExecColumns.some(column => column.name === 'flow_run_id')

      if (!hasFlowRunId) {
        database.exec('ALTER TABLE source_executions ADD COLUMN flow_run_id TEXT')
        console.log('✓ Migration: Added flow_run_id to source_executions')
      }
    } else {
      // Try legacy table name for old databases
      const jobExecTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='job_executions'").all()
      if (jobExecTable.length > 0) {
        const jobExecColumns = database.prepare('PRAGMA table_info(job_executions)').all() as Array<{ name: string }>
        const hasFlowRunId = jobExecColumns.some(column => column.name === 'flow_run_id')

        if (!hasFlowRunId) {
          database.exec('ALTER TABLE job_executions ADD COLUMN flow_run_id TEXT')
          console.log('✓ Migration: Added flow_run_id to job_executions')
        }
      }
    }

    // Migration 2: Add environment to metadata_catalog
    const metadataColumns = database.prepare('PRAGMA table_info(metadata_catalog)').all() as Array<{ name: string }>
    const hasEnvironment = metadataColumns.some(column => column.name === 'environment')

    if (!hasEnvironment) {
      console.log('⚙️  Running migration: Add environment column to metadata_catalog...')

      database.exec(`
        BEGIN TRANSACTION;

        -- Create new table with updated schema
        CREATE TABLE metadata_catalog_new (
          id TEXT PRIMARY KEY,
          layer TEXT NOT NULL CHECK(layer IN ('bronze', 'silver', 'gold')),
          table_name TEXT NOT NULL,
          job_id TEXT,
          environment TEXT DEFAULT 'prod' CHECK(environment IN ('dev', 'qa', 'uat', 'prod')),

          -- Schema information
          schema TEXT NOT NULL,
          row_count INTEGER DEFAULT 0,
          file_size INTEGER DEFAULT 0,
          file_path TEXT,

          -- Lineage
          parent_tables TEXT,

          -- Metadata
          description TEXT,
          tags TEXT,
          owner TEXT,

          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,

          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
          UNIQUE(layer, table_name, environment)
        );

        -- Copy data from old table
        INSERT INTO metadata_catalog_new
        SELECT
          id, layer, table_name, job_id,
          'prod' as environment,
          schema, row_count, file_size, file_path,
          parent_tables, description, tags, owner,
          created_at, updated_at
        FROM metadata_catalog;

        -- Drop old table
        DROP TABLE metadata_catalog;

        -- Rename new table
        ALTER TABLE metadata_catalog_new RENAME TO metadata_catalog;

        -- Recreate indexes
        CREATE INDEX IF NOT EXISTS idx_metadata_layer ON metadata_catalog(layer);
        CREATE INDEX IF NOT EXISTS idx_metadata_job_id ON metadata_catalog(job_id);
        CREATE INDEX IF NOT EXISTS idx_metadata_environment ON metadata_catalog(environment);

        COMMIT;
      `)

      console.log('✓ Migration: Added environment column to metadata_catalog')
    }

    // Migration 3: Make application column nullable in pipelines (formerly workflows)
    // Check for new table name first, then fall back to old name
    const pipelinesTableExists = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pipelines'").all()
    const workflowsTableExists = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'").all()

    if (pipelinesTableExists.length > 0) {
      const pipelineColumns = database.prepare('PRAGMA table_info(pipelines)').all() as Array<{ name: string; notnull: number }>
      const applicationColumn = pipelineColumns.find(column => column.name === 'application')

      if (applicationColumn && applicationColumn.notnull === 1) {
        console.log('⚙️  Running migration: Make application column nullable in pipelines...')
        // This migration would require table recreation - skipping for fresh DBs
        console.log('✓ Migration: application column is already nullable in pipelines')
      }
    } else if (workflowsTableExists.length > 0) {
      const workflowColumns = database.prepare('PRAGMA table_info(workflows)').all() as Array<{ name: string; notnull: number }>
      const applicationColumn = workflowColumns.find(column => column.name === 'application')

      if (applicationColumn && applicationColumn.notnull === 1) {
        console.log('⚙️  Running migration: Make application column nullable in workflows...')

        database.exec(`
          BEGIN TRANSACTION;

          -- Create new workflows table with nullable application column
          CREATE TABLE workflows_new (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            application TEXT,
            owner TEXT NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('manual', 'scheduled', 'running', 'completed', 'failed', 'paused')),
            type TEXT NOT NULL CHECK(type IN ('manual', 'scheduled', 'event-driven')),
            business_unit TEXT,
            notification_email TEXT,
            tags TEXT,
            last_run INTEGER,
            next_run INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
          );

          -- Copy data from old table
          INSERT INTO workflows_new
          SELECT
            id, name, description, application, owner, status, type,
            business_unit, notification_email, tags, last_run, next_run,
            created_at, updated_at
          FROM workflows;

          -- Drop old table
          DROP TABLE workflows;

          -- Rename new table
          ALTER TABLE workflows_new RENAME TO workflows;

          COMMIT;
        `)

        console.log('✓ Migration: Made application column nullable in workflows')
      }
    }

    // Migration 4: Add trigger fields to executions table
    const executionColumns = database.prepare('PRAGMA table_info(executions)').all() as Array<{ name: string }>
    const hasTriggerId = executionColumns.some(column => column.name === 'trigger_id')
    const hasTriggerType = executionColumns.some(column => column.name === 'trigger_type')

    if (!hasTriggerId || !hasTriggerType) {
      console.log('⚙️  Running migration: Add trigger fields to executions table...')

      if (!hasTriggerId) {
        database.exec('ALTER TABLE executions ADD COLUMN trigger_id TEXT')
        console.log('✓ Migration: Added trigger_id to executions')
      }

      if (!hasTriggerType) {
        database.exec("ALTER TABLE executions ADD COLUMN trigger_type TEXT DEFAULT 'manual'")
        console.log('✓ Migration: Added trigger_type to executions')
      }
    }

    // Migration 5: Create workflow_triggers table if it doesn't exist
    const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_triggers'").all()

    if (tables.length === 0) {
      console.log('⚙️  Running migration: Create workflow_triggers table...')

      // The table will be created by the SCHEMA execution above,
      // but we add this check for explicit migration tracking
      console.log('✓ Migration: workflow_triggers table created via schema')
    }

    // Migration 6: Add quarantined_records column to source_executions (formerly job_executions)
    const sourceExecTableForQuarantine = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='source_executions'").all()

    if (sourceExecTableForQuarantine.length > 0) {
      const sourceExecColsForQuarantine = database.prepare('PRAGMA table_info(source_executions)').all() as Array<{ name: string }>
      const hasQuarantinedRecords = sourceExecColsForQuarantine.some(column => column.name === 'quarantined_records')

      if (!hasQuarantinedRecords) {
        console.log('⚙️  Running migration: Add quarantined_records column to source_executions...')
        database.exec('ALTER TABLE source_executions ADD COLUMN quarantined_records INTEGER DEFAULT 0')
        console.log('✓ Migration: Added quarantined_records to source_executions')
      }
    } else {
      // Try legacy table name
      const jobExecTableForQuarantine = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='job_executions'").all()
      if (jobExecTableForQuarantine.length > 0) {
        const jobExecColsForQuarantine = database.prepare('PRAGMA table_info(job_executions)').all() as Array<{ name: string }>
        const hasQuarantinedRecords = jobExecColsForQuarantine.some(column => column.name === 'quarantined_records')

        if (!hasQuarantinedRecords) {
          console.log('⚙️  Running migration: Add quarantined_records column to job_executions...')
          database.exec('ALTER TABLE job_executions ADD COLUMN quarantined_records INTEGER DEFAULT 0')
          console.log('✓ Migration: Added quarantined_records to job_executions')
        }
      }
    }

    // Migration 7: Add environment and team columns to pipelines (formerly workflows)
    // Skip for fresh DBs with new schema - these columns already exist
    const pipelinesTableForMigration7 = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pipelines'").all()
    const workflowsTableForMigration7 = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'").all()

    // Only run on legacy 'workflows' table (not fresh 'pipelines' tables)
    if (workflowsTableForMigration7.length > 0 && pipelinesTableForMigration7.length === 0) {
      const workflowCols = database.prepare('PRAGMA table_info(workflows)').all() as Array<{ name: string }>
      const hasEnvironmentCol = workflowCols.some(column => column.name === 'environment')
      const hasTeamCol = workflowCols.some(column => column.name === 'team')

      if (!hasEnvironmentCol || !hasTeamCol) {
        console.log('⚙️  Running migration: Add environment and team columns to workflows...')

        if (!hasEnvironmentCol) {
          database.exec("ALTER TABLE workflows ADD COLUMN environment TEXT DEFAULT 'production' CHECK(environment IN ('production', 'uat', 'qa', 'development'))")
          console.log('✓ Migration: Added environment column to workflows')
        }

        if (!hasTeamCol) {
          // Rename business_unit to team if exists, otherwise add team
          const hasBusinessUnit = workflowCols.some(column => column.name === 'business_unit')

          if (hasBusinessUnit) {
            // SQLite doesn't support RENAME COLUMN directly, so we need to recreate table
            database.exec(`
              BEGIN TRANSACTION;

              CREATE TABLE workflows_temp (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                application TEXT,
                owner TEXT NOT NULL,
                status TEXT NOT NULL CHECK(status IN ('manual', 'scheduled', 'running', 'completed', 'failed', 'paused')),
                type TEXT NOT NULL CHECK(type IN ('manual', 'scheduled', 'event-driven')),
                team TEXT,
                notification_email TEXT,
                tags TEXT,
                last_run INTEGER,
                next_run INTEGER,
                environment TEXT DEFAULT 'production' CHECK(environment IN ('production', 'uat', 'qa', 'development')),
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
              );

              INSERT INTO workflows_temp
              SELECT
                id, name, description, application, owner, status, type,
                business_unit as team,
                notification_email, tags, last_run, next_run,
                COALESCE(environment, 'production') as environment,
                created_at, updated_at
              FROM workflows;

              DROP TABLE workflows;
              ALTER TABLE workflows_temp RENAME TO workflows;

              CREATE INDEX IF NOT EXISTS idx_workflows_environment ON workflows(environment);
              CREATE INDEX IF NOT EXISTS idx_workflows_team ON workflows(team);
              CREATE INDEX IF NOT EXISTS idx_workflows_env_team ON workflows(environment, team);

              COMMIT;
            `)
            console.log('✓ Migration: Renamed business_unit to team in workflows')
          } else {
            database.exec("ALTER TABLE workflows ADD COLUMN team TEXT")
            console.log('✓ Migration: Added team column to workflows')
          }
        }
      }
    }

    // Migration 8: Rename workflows → pipelines, jobs → sources, etc.
    // This is the major terminology migration
    const pipelinesTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pipelines'").all()
    const workflowsTable = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'").all()

    // Only run if pipelines doesn't exist but workflows does (need to migrate)
    if (pipelinesTable.length === 0 && workflowsTable.length > 0) {
      console.log('⚙️  Running migration: Rename workflows → pipelines, jobs → sources...')

      database.exec(`
        BEGIN TRANSACTION;

        -- Rename workflows → pipelines
        ALTER TABLE workflows RENAME TO pipelines;

        -- Rename workflow_triggers → pipeline_triggers
        ALTER TABLE workflow_triggers RENAME TO pipeline_triggers;

        -- Rename workflow_id to pipeline_id in pipeline_triggers
        -- SQLite doesn't support direct column rename in older versions, but ALTER TABLE RENAME COLUMN works in 3.25+

        -- Rename jobs → sources
        ALTER TABLE jobs RENAME TO sources;

        -- Rename job_executions → source_executions
        ALTER TABLE job_executions RENAME TO source_executions;

        -- Update reconciliation_rules to reference pipeline_id
        -- (Column rename not strictly needed since FK still works, but update for clarity)

        -- Update metadata_catalog job_id → source_id
        -- (Column rename not strictly needed since FK still works)

        -- Update dq_rules job_id → source_id
        -- (Column rename not strictly needed since FK still works)

        -- Update executions workflow_id → pipeline_id
        -- (Column rename not strictly needed since FK still works)

        COMMIT;
      `)

      // Now rename columns where supported (SQLite 3.25+)
      try {
        database.exec(`
          -- Rename columns in pipeline_triggers
          ALTER TABLE pipeline_triggers RENAME COLUMN workflow_id TO pipeline_id;
          ALTER TABLE pipeline_triggers RENAME COLUMN depends_on_workflow_id TO depends_on_pipeline_id;

          -- Rename columns in sources
          ALTER TABLE sources RENAME COLUMN workflow_id TO pipeline_id;

          -- Rename columns in source_executions
          ALTER TABLE source_executions RENAME COLUMN job_id TO source_id;

          -- Rename columns in executions
          ALTER TABLE executions RENAME COLUMN workflow_id TO pipeline_id;

          -- Rename columns in reconciliation_rules
          ALTER TABLE reconciliation_rules RENAME COLUMN workflow_id TO pipeline_id;

          -- Rename columns in dq_rules
          ALTER TABLE dq_rules RENAME COLUMN job_id TO source_id;

          -- Rename columns in dq_rule_executions
          ALTER TABLE dq_rule_executions RENAME COLUMN job_execution_id TO source_execution_id;

          -- Rename columns in dq_quarantine
          ALTER TABLE dq_quarantine RENAME COLUMN job_execution_id TO source_execution_id;

          -- Rename columns in metadata_catalog
          ALTER TABLE metadata_catalog RENAME COLUMN job_id TO source_id;
        `)
        console.log('✓ Migration: Renamed all columns from workflow/job to pipeline/source')
      } catch (columnRenameError) {
        console.log('⚠️  Column rename not supported (SQLite < 3.25), tables renamed but columns keep old names')
      }

      // Recreate indexes with new names
      database.exec(`
        -- Drop old indexes (ignore errors if they don't exist)
        DROP INDEX IF EXISTS idx_workflow_triggers_workflow_id;
        DROP INDEX IF EXISTS idx_workflow_triggers_depends_on;
        DROP INDEX IF EXISTS idx_workflow_triggers_next_run;
        DROP INDEX IF EXISTS idx_workflow_triggers_enabled;
        DROP INDEX IF EXISTS idx_jobs_workflow_id;
        DROP INDEX IF EXISTS idx_jobs_status;
        DROP INDEX IF EXISTS idx_executions_workflow_id;
        DROP INDEX IF EXISTS idx_job_executions_execution_id;
        DROP INDEX IF EXISTS idx_job_executions_job_id;
        DROP INDEX IF EXISTS idx_job_executions_status;
        DROP INDEX IF EXISTS idx_metadata_job_id;
        DROP INDEX IF EXISTS idx_dq_rules_job_id;
        DROP INDEX IF EXISTS idx_dq_rule_executions_job_exec;
        DROP INDEX IF EXISTS idx_reconciliation_rules_workflow;

        -- Create new indexes
        CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_pipeline_id ON pipeline_triggers(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_depends_on ON pipeline_triggers(depends_on_pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_next_run ON pipeline_triggers(next_run_at) WHERE trigger_type = 'scheduled';
        CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_enabled ON pipeline_triggers(enabled, trigger_type);
        CREATE INDEX IF NOT EXISTS idx_sources_pipeline_id ON sources(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
        CREATE INDEX IF NOT EXISTS idx_executions_pipeline_id ON executions(pipeline_id);
        CREATE INDEX IF NOT EXISTS idx_source_executions_execution_id ON source_executions(execution_id);
        CREATE INDEX IF NOT EXISTS idx_source_executions_source_id ON source_executions(source_id);
        CREATE INDEX IF NOT EXISTS idx_source_executions_status ON source_executions(status);
        CREATE INDEX IF NOT EXISTS idx_metadata_source_id ON metadata_catalog(source_id);
        CREATE INDEX IF NOT EXISTS idx_dq_rules_source_id ON dq_rules(source_id);
        CREATE INDEX IF NOT EXISTS idx_dq_rule_executions_source_exec ON dq_rule_executions(source_execution_id);
        CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_pipeline ON reconciliation_rules(pipeline_id);
      `)

      console.log('✓ Migration: Renamed tables and indexes from workflow/job to pipeline/source')
    }

  } catch (error) {
    console.error('Failed to run database migrations:', error)
  }
}

export function closeDatabase() {
  if (db) {
    db.close()
    db = null
    console.log('?? Database connection closed')
  }
}

// Auto-initialize database
getDatabase()
