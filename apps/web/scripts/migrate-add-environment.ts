/**
 * Database Migration: Add environment column to metadata_catalog
 * Run with: npx tsx scripts/migrate-add-environment.ts
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'flowforge.db');

function migrateDatabase() {
  console.log('Starting database migration...');
  console.log('Database path:', DB_PATH);

  const db = new Database(DB_PATH);

  try {
    // Check if environment column already exists
    const tableInfo = db.pragma('table_info(metadata_catalog)');
    const hasEnvironment = tableInfo.some((col: any) => col.name === 'environment');

    if (hasEnvironment) {
      console.log('✓ Environment column already exists, skipping migration');
      db.close();
      return;
    }

    console.log('Adding environment column to metadata_catalog...');

    // Add environment column with default 'prod'
    db.exec(`
      ALTER TABLE metadata_catalog ADD COLUMN environment TEXT DEFAULT 'prod' CHECK(environment IN ('dev', 'qa', 'uat', 'prod'));
    `);

    console.log('✓ Added environment column');

    // Update the unique constraint to include environment
    // SQLite doesn't support ALTER TABLE for constraints, so we need to recreate the table
    console.log('Updating unique constraint...');

    db.exec(`
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
        COALESCE(environment, 'prod') as environment,
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
    `);

    console.log('✓ Updated unique constraint to include environment');

    // Verify migration
    const newTableInfo = db.pragma('table_info(metadata_catalog)');
    const environmentCol = newTableInfo.find((col: any) => col.name === 'environment');

    if (environmentCol) {
      console.log('✓ Migration completed successfully');
      console.log('  Environment column details:', environmentCol);
    } else {
      throw new Error('Migration verification failed - environment column not found');
    }

    // Show current row count
    const count = db.prepare('SELECT COUNT(*) as count FROM metadata_catalog').get() as any;
    console.log(`✓ Total assets in catalog: ${count.count}`);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

migrateDatabase();
