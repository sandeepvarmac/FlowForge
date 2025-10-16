/**
 * Database Schema for FlowForge
 * SQLite database structure for metadata storage
 */

export const SCHEMA = `
-- Workflows table
CREATE TABLE IF NOT EXISTS workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  application TEXT, -- Made nullable - workflow is agnostic and can contain multiple source types
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('manual', 'scheduled', 'running', 'completed', 'failed', 'paused')),
  type TEXT NOT NULL CHECK(type IN ('manual', 'scheduled', 'event-driven')),
  business_unit TEXT,
  notification_email TEXT,
  tags TEXT, -- JSON array
  last_run INTEGER, -- Unix timestamp
  next_run INTEGER, -- Unix timestamp
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workflow Triggers table
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('manual', 'scheduled', 'dependency', 'event')),
  enabled INTEGER DEFAULT 1,
  trigger_name TEXT,

  -- For scheduled triggers
  cron_expression TEXT,
  timezone TEXT DEFAULT 'UTC',
  next_run_at INTEGER, -- Unix timestamp
  last_run_at INTEGER, -- Unix timestamp

  -- For dependency triggers
  depends_on_workflow_id TEXT,
  dependency_condition TEXT CHECK(dependency_condition IN ('on_success', 'on_failure', 'on_completion')),
  delay_minutes INTEGER DEFAULT 0,

  -- For event triggers (future)
  event_type TEXT,
  event_config TEXT, -- JSON

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
  FOREIGN KEY (depends_on_workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
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

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Workflow Executions table
CREATE TABLE IF NOT EXISTS executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed', 'cancelled')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- Job Executions table
CREATE TABLE IF NOT EXISTS job_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  started_at TEXT NOT NULL,
  completed_at TEXT,
  duration_ms INTEGER,

  -- Record counts
  records_processed INTEGER DEFAULT 0,
  bronze_records INTEGER DEFAULT 0,
  silver_records INTEGER DEFAULT 0,
  gold_records INTEGER DEFAULT 0,

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
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Data Quality Rules table
CREATE TABLE IF NOT EXISTS dq_rules (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK(rule_type IN ('not_null', 'unique', 'range', 'pattern', 'custom')),
  column_name TEXT NOT NULL,
  parameters TEXT, -- JSON
  severity TEXT NOT NULL CHECK(severity IN ('warning', 'error')),
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,

  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

-- Metadata Catalog table
CREATE TABLE IF NOT EXISTS metadata_catalog (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL CHECK(layer IN ('bronze', 'silver', 'gold')),
  table_name TEXT NOT NULL,
  job_id TEXT,
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

  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL,
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
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_workflow_id ON workflow_triggers(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_depends_on ON workflow_triggers(depends_on_workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_next_run ON workflow_triggers(next_run_at) WHERE trigger_type = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_workflow_triggers_enabled ON workflow_triggers(enabled, trigger_type);
CREATE INDEX IF NOT EXISTS idx_jobs_workflow_id ON jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_executions_workflow_id ON executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_job_executions_execution_id ON job_executions(execution_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_job_id ON job_executions(job_id);
CREATE INDEX IF NOT EXISTS idx_job_executions_status ON job_executions(status);
CREATE INDEX IF NOT EXISTS idx_metadata_layer ON metadata_catalog(layer);
CREATE INDEX IF NOT EXISTS idx_metadata_job_id ON metadata_catalog(job_id);
CREATE INDEX IF NOT EXISTS idx_metadata_environment ON metadata_catalog(environment);
CREATE INDEX IF NOT EXISTS idx_dq_rules_job_id ON dq_rules(job_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);
`;
