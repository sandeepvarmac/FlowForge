/**
 * Migration script to add Quality and Reconciliation tables
 * Run with: npx ts-node scripts/migrate-quality-recon.ts
 */

import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'data', 'flowforge.db')

async function migrate() {
  console.log('=' .repeat(60))
  console.log('Quality & Reconciliation Schema Migration')
  console.log('=' .repeat(60))
  console.log()

  const db = new Database(DB_PATH)

  try {
    console.log(`Opening database: ${DB_PATH}`)

    // Check if tables already exist
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name IN (
        'dq_rule_executions',
        'dq_quarantine',
        'reconciliation_rules',
        'reconciliation_executions'
      )
    `).all()

    if (tables.length > 0) {
      console.log(`\nFound existing tables: ${tables.map((t: any) => t.name).join(', ')}`)
      console.log('Migration may have already run. Continuing anyway...')
    }

    console.log('\n[1/5] Altering dq_rules table...')

    // Check if dq_rules needs migration
    const dqRulesInfo = db.prepare("PRAGMA table_info(dq_rules)").all()
    const hasRuleId = dqRulesInfo.some((col: any) => col.name === 'rule_id')

    if (!hasRuleId) {
      console.log('  - Adding new columns to dq_rules table')
      db.exec(`
        -- Create new dq_rules table with additional columns
        CREATE TABLE IF NOT EXISTS dq_rules_new (
          id TEXT PRIMARY KEY,
          job_id TEXT NOT NULL,
          rule_id TEXT NOT NULL,
          rule_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          rule_type TEXT NOT NULL CHECK(rule_type IN ('not_null', 'unique', 'range', 'pattern', 'enum', 'custom')),
          parameters TEXT,
          confidence INTEGER DEFAULT 0,
          current_compliance TEXT,
          reasoning TEXT,
          ai_generated INTEGER DEFAULT 0,
          severity TEXT NOT NULL CHECK(severity IN ('error', 'warning', 'info')),
          is_active INTEGER DEFAULT 1,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        );

        -- Copy data from old table
        INSERT INTO dq_rules_new (id, job_id, rule_id, rule_name, column_name, rule_type, parameters, severity, is_active, created_at, updated_at)
        SELECT
          id,
          job_id,
          COALESCE(name, column_name || '_rule') as rule_id,
          name,
          column_name,
          rule_type,
          parameters,
          severity,
          is_active,
          created_at,
          created_at as updated_at
        FROM dq_rules;

        -- Drop old table and rename new table
        DROP TABLE dq_rules;
        ALTER TABLE dq_rules_new RENAME TO dq_rules;
      `)
      console.log('  ✓ dq_rules table migrated')
    } else {
      console.log('  ✓ dq_rules table already up to date')
    }

    console.log('\n[2/5] Creating dq_rule_executions table...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS dq_rule_executions (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        job_execution_id TEXT NOT NULL,
        execution_time INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'warning', 'skipped')),
        records_checked INTEGER DEFAULT 0,
        records_passed INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        pass_percentage REAL DEFAULT 0.0,
        failed_records_sample TEXT,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (rule_id) REFERENCES dq_rules(id) ON DELETE CASCADE,
        FOREIGN KEY (job_execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
      );
    `)
    console.log('  ✓ dq_rule_executions table created')

    console.log('\n[3/5] Creating dq_quarantine table...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS dq_quarantine (
        id TEXT PRIMARY KEY,
        rule_execution_id TEXT NOT NULL,
        job_execution_id TEXT NOT NULL,
        record_data TEXT NOT NULL,
        failure_reason TEXT NOT NULL,
        quarantine_status TEXT CHECK(quarantine_status IN ('quarantined', 'approved', 'rejected', 'fixed')),
        reviewed_by TEXT,
        reviewed_at INTEGER,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (rule_execution_id) REFERENCES dq_rule_executions(id) ON DELETE CASCADE,
        FOREIGN KEY (job_execution_id) REFERENCES job_executions(id) ON DELETE CASCADE
      );
    `)
    console.log('  ✓ dq_quarantine table created')

    console.log('\n[4/5] Creating reconciliation_rules table...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS reconciliation_rules (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        rule_name TEXT NOT NULL,
        rule_type TEXT NOT NULL CHECK(rule_type IN ('count', 'sum', 'hash', 'column', 'custom')),
        source_layer TEXT NOT NULL CHECK(source_layer IN ('bronze', 'silver', 'gold')),
        target_layer TEXT NOT NULL CHECK(target_layer IN ('bronze', 'silver', 'gold')),
        source_table TEXT NOT NULL,
        target_table TEXT,
        column_name TEXT,
        tolerance_percentage REAL DEFAULT 0.0,
        ai_generated INTEGER DEFAULT 0,
        confidence INTEGER DEFAULT 0,
        reasoning TEXT,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      );
    `)
    console.log('  ✓ reconciliation_rules table created')

    console.log('\n[5/5] Creating reconciliation_executions table...')
    db.exec(`
      CREATE TABLE IF NOT EXISTS reconciliation_executions (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        execution_id TEXT NOT NULL,
        execution_time INTEGER NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'warning')),
        source_value TEXT,
        target_value TEXT,
        difference TEXT,
        difference_percentage REAL,
        ai_explanation TEXT,
        pass_threshold_met INTEGER DEFAULT 1,
        error_message TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (rule_id) REFERENCES reconciliation_rules(id) ON DELETE CASCADE,
        FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
      );
    `)
    console.log('  ✓ reconciliation_executions table created')

    console.log('\n[6/6] Creating indexes...')
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_dq_rules_active ON dq_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_dq_rule_executions_rule_id ON dq_rule_executions(rule_id);
      CREATE INDEX IF NOT EXISTS idx_dq_rule_executions_job_exec ON dq_rule_executions(job_execution_id);
      CREATE INDEX IF NOT EXISTS idx_dq_quarantine_status ON dq_quarantine(quarantine_status);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_workflow ON reconciliation_rules(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_active ON reconciliation_rules(is_active);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_executions_rule ON reconciliation_executions(rule_id);
      CREATE INDEX IF NOT EXISTS idx_reconciliation_executions_exec ON reconciliation_executions(execution_id);
    `)
    console.log('  ✓ Indexes created')

    // Verify tables
    console.log('\n' + '='.repeat(60))
    console.log('Verifying migration...')
    console.log('='.repeat(60))

    const allTables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name LIKE 'dq_%' OR name LIKE 'reconciliation_%'
      ORDER BY name
    `).all()

    console.log('\nCreated tables:')
    allTables.forEach((table: any) => {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as any
      console.log(`  ✓ ${table.name} (${count.count} records)`)
    })

    console.log('\n' + '='.repeat(60))
    console.log('✓ Migration completed successfully!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n✗ Migration failed:', error)
    throw error
  } finally {
    db.close()
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
