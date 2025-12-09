/**
 * Database Schema for FlowForge
 * SQLite database structure for metadata storage
 *
 * Terminology:
 * - Pipeline: A container for related data sources (formerly "Workflow")
 * - Source: An individual data ingestion task (formerly "Job")
 */

export const SCHEMA = `
-- Database Connections table (for reusable database source connections)
CREATE TABLE IF NOT EXISTS database_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('sql-server', 'postgresql', 'mysql', 'oracle')),

  -- Connection details (encrypted in production)
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  database TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,

  -- Additional settings
  ssl_enabled INTEGER DEFAULT 0,
  connection_timeout INTEGER DEFAULT 30,

  -- Metadata
  last_tested_at INTEGER,
  last_test_status TEXT CHECK(last_test_status IN ('success', 'failed')),
  last_test_message TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Storage Connections table (for file & storage source connections: S3, MinIO, Local, SFTP)
CREATE TABLE IF NOT EXISTS storage_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('local', 's3', 'azure-blob', 'sftp', 'gcs')),

  -- Configuration stored as JSON (varies by type)
  config TEXT NOT NULL,

  -- Metadata
  last_tested_at INTEGER,
  last_test_status TEXT CHECK(last_test_status IN ('success', 'failed')),
  last_test_message TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Pipelines table (formerly Workflows)
CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  application TEXT, -- Made nullable - pipeline is agnostic and can contain multiple source types
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('manual', 'scheduled', 'running', 'completed', 'failed', 'paused')),
  type TEXT NOT NULL CHECK(type IN ('manual', 'scheduled', 'event-driven')),
  business_unit TEXT,
  team TEXT, -- Team responsible for this pipeline
  environment TEXT, -- development, qa, uat, production
  priority TEXT, -- high, medium, low
  data_classification TEXT, -- public, internal, confidential, pii-sensitive
  notification_email TEXT,
  tags TEXT, -- JSON array
  last_run INTEGER, -- Unix timestamp
  next_run INTEGER, -- Unix timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Pipeline Triggers table (formerly Workflow Triggers)
CREATE TABLE IF NOT EXISTS pipeline_triggers (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'scheduled', 'dependency', 'event')),
  enabled INTEGER DEFAULT 1,
  trigger_name TEXT,

  -- For scheduled triggers
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  next_run_at INTEGER, -- Unix timestamp
  last_run_at INTEGER, -- Unix timestamp

  -- For dependency triggers
  depends_on_pipeline_id TEXT,
  dependency_condition TEXT CHECK(dependency_condition IN ('on_success', 'on_failure', 'on_completion')),
  delay_minutes INTEGER DEFAULT 0,

  -- For event triggers (future)
  event_type TEXT,
  event_config TEXT, -- JSON

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

-- Sources table (formerly Jobs) - Individual data ingestion tasks
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK(type IN ('file-based', 'database', 'api', 'gold-analytics', 'nosql')),
  order_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('configured', 'ready', 'running', 'completed', 'failed', 'disabled')),

  -- Configuration stored as JSON
  source_config TEXT NOT NULL, -- JSON
  destination_config TEXT NOT NULL, -- JSON
  transformation_config TEXT, -- JSON (optional)
  validation_config TEXT, -- JSON (optional)

  last_run INTEGER, -- Unix timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

-- Pipeline Executions table (formerly Workflow Executions)
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

-- Source Executions table (formerly Job Executions)
CREATE TABLE IF NOT EXISTS source_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,

  -- Record counts
  records_processed INTEGER DEFAULT 0,
  bronze_records INTEGER DEFAULT 0,
  silver_records INTEGER DEFAULT 0,
  gold_records INTEGER DEFAULT 0,
  quarantined_records INTEGER DEFAULT 0,

  -- File paths
  source_file_path TEXT,
  bronze_file_path TEXT,
  silver_file_path TEXT,
  gold_file_path TEXT,

  -- Results
  validation_results TEXT, -- JSON
  logs TEXT, -- JSON array
  error_message TEXT,

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Data Quality Rules table
CREATE TABLE IF NOT EXISTS dq_rules (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  rule_id TEXT NOT NULL, -- Unique rule identifier (e.g., 'email_format_validation')
  rule_name TEXT NOT NULL, -- Human-readable name
  column_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('not_null', 'unique', 'range', 'pattern', 'enum', 'custom')),
  parameters TEXT, -- JSON {min, max, pattern, allowed_values, custom_sql}

  -- AI-generated metadata
  confidence INTEGER DEFAULT 0, -- AI confidence score (0-100)
  current_compliance TEXT, -- e.g., "95% of records pass"
  reasoning TEXT, -- AI explanation for this rule
  ai_generated INTEGER DEFAULT 0, -- 1 if AI suggested, 0 if user-created

  severity TEXT NOT NULL CHECK(severity IN ('error', 'warning', 'info')),
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
);

-- Quality Rule Execution Results table
CREATE TABLE IF NOT EXISTS dq_rule_executions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL, -- FK to dq_rules.id
  source_execution_id TEXT NOT NULL, -- FK to source_executions.id
  execution_time INTEGER NOT NULL,

  -- Results
  status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'warning', 'skipped')),
  records_checked INTEGER DEFAULT 0,
  records_passed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  pass_percentage REAL DEFAULT 0.0,

  -- Failed records (sample)
  failed_records_sample TEXT, -- JSON array of failed records
  error_message TEXT,

  created_at INTEGER NOT NULL,

  FOREIGN KEY (rule_id) REFERENCES dq_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (source_execution_id) REFERENCES source_executions(id) ON DELETE CASCADE
);

-- Quality Quarantine table (stores records that failed quality checks)
CREATE TABLE IF NOT EXISTS dq_quarantine (
  id TEXT PRIMARY KEY,
  rule_execution_id TEXT NOT NULL,
  source_execution_id TEXT NOT NULL,
  record_data TEXT NOT NULL, -- JSON of the failed record
  failure_reason TEXT NOT NULL,
  quarantine_status TEXT CHECK(quarantine_status IN ('quarantined', 'approved', 'rejected', 'fixed')),
  reviewed_by TEXT,
  reviewed_at INTEGER,
  created_at INTEGER NOT NULL,

  FOREIGN KEY (rule_execution_id) REFERENCES dq_rule_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (source_execution_id) REFERENCES source_executions(id) ON DELETE CASCADE
);

-- Reconciliation Rules table
CREATE TABLE IF NOT EXISTS reconciliation_rules (
  id TEXT PRIMARY KEY,
  pipeline_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('count', 'sum', 'hash', 'column', 'custom')),

  -- Source and target layers
  source_layer TEXT NOT NULL CHECK(source_layer IN ('bronze', 'silver', 'gold')),
  target_layer TEXT NOT NULL CHECK(target_layer IN ('bronze', 'silver', 'gold')),

  -- Configuration
  source_table TEXT NOT NULL,
  target_table TEXT,
  column_name TEXT, -- For sum/column reconciliation
  tolerance_percentage REAL DEFAULT 0.0, -- Allow X% variance

  -- AI-generated metadata
  ai_generated INTEGER DEFAULT 0,
  confidence INTEGER DEFAULT 0,
  reasoning TEXT,

  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (pipeline_id) REFERENCES pipelines(id) ON DELETE CASCADE
);

-- Reconciliation Execution Results table
CREATE TABLE IF NOT EXISTS reconciliation_executions (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  execution_id TEXT NOT NULL, -- FK to executions.id
  execution_time INTEGER NOT NULL,

  -- Results
  status TEXT NOT NULL CHECK(status IN ('passed', 'failed', 'warning')),
  source_value TEXT, -- Stringified value (could be count, sum, etc.)
  target_value TEXT,
  difference TEXT,
  difference_percentage REAL,

  -- AI explanation
  ai_explanation TEXT, -- AI-generated explanation of discrepancy

  pass_threshold_met INTEGER DEFAULT 1, -- 1 if within tolerance
  error_message TEXT,

  created_at INTEGER NOT NULL,

  FOREIGN KEY (rule_id) REFERENCES reconciliation_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

-- Metadata Catalog table
CREATE TABLE IF NOT EXISTS metadata_catalog (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL CHECK(layer IN ('bronze', 'silver', 'gold')),
  table_name TEXT NOT NULL,
  source_id TEXT,
  environment TEXT DEFAULT 'prod' CHECK(environment IN ('dev', 'qa', 'uat', 'prod')),

  -- Schema information
  schema TEXT NOT NULL, -- JSON
  row_count INTEGER DEFAULT 0,
  file_size INTEGER DEFAULT 0, -- bytes
  file_path TEXT,

  -- Lineage
  parent_tables TEXT, -- JSON array

  -- Metadata
  description TEXT,
  tags TEXT, -- JSON array
  owner TEXT,

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
  UNIQUE(layer, table_name, environment)
);

-- AI Schema Analysis Cache table
CREATE TABLE IF NOT EXISTS ai_schema_analysis (
  id TEXT PRIMARY KEY,
  file_hash TEXT NOT NULL UNIQUE,
  original_schema TEXT NOT NULL, -- JSON
  ai_enhanced_schema TEXT NOT NULL, -- JSON with AI suggestions
  ai_suggestions TEXT, -- JSON
  confidence_score REAL,
  created_at INTEGER NOT NULL
);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  changes TEXT, -- JSON
  timestamp INTEGER NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_database_connections_type ON database_connections(type);
CREATE INDEX IF NOT EXISTS idx_database_connections_name ON database_connections(name);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_pipeline_id ON pipeline_triggers(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_depends_on ON pipeline_triggers(depends_on_pipeline_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_next_run ON pipeline_triggers(next_run_at) WHERE trigger_type = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_pipeline_triggers_enabled ON pipeline_triggers(enabled, trigger_type);
CREATE INDEX IF NOT EXISTS idx_sources_pipeline_id ON sources(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_sources_status ON sources(status);
CREATE INDEX IF NOT EXISTS idx_executions_pipeline_id ON executions(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_source_executions_execution_id ON source_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_source_executions_source_id ON source_executions(source_id);
CREATE INDEX IF NOT EXISTS idx_source_executions_status ON source_executions(status);
CREATE INDEX IF NOT EXISTS idx_metadata_layer ON metadata_catalog(layer);
CREATE INDEX IF NOT EXISTS idx_metadata_source_id ON metadata_catalog(source_id);
CREATE INDEX IF NOT EXISTS idx_metadata_environment ON metadata_catalog(environment);
CREATE INDEX IF NOT EXISTS idx_dq_rules_source_id ON dq_rules(source_id);
CREATE INDEX IF NOT EXISTS idx_dq_rules_active ON dq_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_dq_rule_executions_rule_id ON dq_rule_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_dq_rule_executions_source_exec ON dq_rule_executions(source_execution_id);
CREATE INDEX IF NOT EXISTS idx_dq_quarantine_status ON dq_quarantine(quarantine_status);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_pipeline ON reconciliation_rules(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_rules_active ON reconciliation_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_reconciliation_executions_rule ON reconciliation_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_executions_exec ON reconciliation_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
`;
