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
