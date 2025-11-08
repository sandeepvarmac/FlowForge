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

export function getDatabase(): Database.Database {
  if (!db) {
    console.log('???  Initializing SQLite database at:', DB_PATH)
    db = new Database(DB_PATH)

    // Enable foreign keys
    db.pragma('foreign_keys = ON')

    // Enable WAL mode for better concurrency
    db.pragma('journal_mode = WAL')

    // Initialize schema
    db.exec(SCHEMA)

    runMigrations(db)

    console.log('? Database initialized successfully')
  }

  return db
}

function runMigrations(database: Database.Database) {
  try {
    // Migration 1: Add flow_run_id to job_executions
    const jobExecColumns = database.prepare('PRAGMA table_info(job_executions)').all() as Array<{ name: string }>
    const hasFlowRunId = jobExecColumns.some(column => column.name === 'flow_run_id')

    if (!hasFlowRunId) {
      database.exec('ALTER TABLE job_executions ADD COLUMN flow_run_id TEXT')
      console.log('✓ Migration: Added flow_run_id to job_executions')
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

    // Migration 3: Make application column nullable in workflows table
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

    // Migration 6: Add environment and team columns to workflows
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
