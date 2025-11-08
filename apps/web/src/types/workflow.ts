export interface Workflow {
  id: string
  name: string
  description?: string
  application: string
  owner: string
  status: WorkflowStatus
  type: WorkflowType
  jobs: Job[]
  lastRun?: Date
  nextRun?: Date
  createdAt: Date
  updatedAt: Date
  // EDP-specific fields
  businessUnit?: string
  team?: string
  environment?: 'dev' | 'qa' | 'prod'
  dataClassification?: 'public' | 'internal' | 'confidential' | 'pii'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  notificationEmail?: string
  tags?: string[]
  retentionDays?: number
  // Execution summary
  lastExecution?: {
    id: string
    status: ExecutionStatus
    startTime?: Date
    endTime?: Date
    duration?: number
    completedJobs: number
    failedJobs: number
    totalJobs: number
  } | null
}

export type WorkflowStatus =
  | 'manual'
  | 'scheduled'
  | 'dependency'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'

export type WorkflowType = 
  | 'manual'
  | 'scheduled'
  | 'event-driven'

export interface WorkflowFormData {
  name: string
  description: string
  application: string
  businessUnit: string
  team: string
  workflowType: WorkflowType
  environment?: 'dev' | 'qa' | 'prod'
  dataClassification?: 'public' | 'internal' | 'confidential' | 'pii'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  notificationEmail?: string
  tags?: string[]
  retentionDays?: number
}

export interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  duration?: number
  logs?: string[]
  error?: string
}

export type ExecutionStatus = 
  | 'pending'
  | 'running' 
  | 'completed'
  | 'failed'
  | 'cancelled'

// Job Types for EDP Architecture
export interface Job {
  id: string
  workflowId: string
  name: string
  description?: string
  type: JobType
  order: number
  sourceConfig: DataSourceConfig
  destinationConfig: DestinationConfig
  transformationConfig?: TransformationConfig
  validationConfig?: ValidationConfig
  status: JobStatus
  lastRun?: Date
  createdAt: Date
  updatedAt: Date
}

export type JobType =
  | 'file-based'
  | 'database'
  | 'nosql'
  | 'api'
  | 'gold-analytics' // Special type for Gold layer that reads from multiple Silver tables

export type JobStatus = 
  | 'configured'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'disabled'

// Data Source Configuration
export interface DataSourceConfig {
  id: string
  name: string
  type: DataSourceType
  connection: ConnectionConfig
  fileConfig?: FileSourceConfig
  databaseConfig?: DatabaseSourceConfig
  apiConfig?: ApiSourceConfig
}

export type DataSourceType =
  | 'csv'
  | 'excel'
  | 'json'
  | 'parquet'
  | 'sql-server'
  | 'postgresql'
  | 'oracle'
  | 'mysql'
  | 'snowflake'
  | 'mongodb'
  | 'cassandra'
  | 'documentdb'
  | 's3'
  | 'azure-blob'
  | 'gcs'
  | 'sftp'
  | 'api'

export interface ConnectionConfig {
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  connectionString?: string
  awsRegion?: string
  bucketName?: string
  secretsManagerKey?: string
}

export interface FileSourceConfig {
  filePath: string
  filePattern?: string
  uploadMode?: 'single' | 'pattern' | 'directory' // Single file, pattern match, or directory watch
  matchedFiles?: string[] // List of files matched by pattern (populated after scan)
  encoding?: string
  delimiter?: string
  hasHeader: boolean
  skipRows?: number
  skipFooterRows?: number
  compressionType?: 'none' | 'zip' | 'gzip'
}

export interface DatabaseSourceConfig {
  tableName?: string
  query?: string
  storedProcedure?: string
  deltaColumn?: string
  lastWatermark?: string | Date
  isIncremental: boolean
}

export interface ApiSourceConfig {
  endpoint: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  authType?: 'none' | 'basic' | 'bearer' | 'api-key'
  authConfig?: Record<string, string>
}

// Destination Configuration (Bronze/Silver/Gold)
export interface DestinationConfig {
  bronzeConfig: LayerConfig
  silverConfig?: LayerConfig
  goldConfig?: LayerConfig
}

export interface LayerConfig {
  enabled: boolean
  tableName: string
  partitionKeys?: string[]
  storageFormat: 'parquet' | 'iceberg' | 'delta'
  retentionDays?: number
  // Bronze-specific
  loadStrategy?: 'append' | 'full_refresh' | 'incremental' // Bronze: append, truncate+reload, or incremental
  auditColumns?: boolean // Add _ingested_at, _source_file, _row_number
  auditColumnsBatchId?: boolean // Add _batch_id (UUID)
  auditColumnsSourceSystem?: boolean // Add _source_system
  auditColumnsFileModified?: boolean // Add _file_modified_at
  watermarkColumn?: string // For incremental loads
  watermarkType?: 'timestamp' | 'integer' | 'date' // Type of watermark
  lookbackWindowHours?: number // For incremental: how far back to look
  partitionStrategy?: 'hive' | 'delta' | 'iceberg' // Partitioning strategy
  schemaEvolution?: 'strict' | 'add_new_columns' | 'ignore_extra' // Schema change handling
  // Silver-specific
  primaryKey?: string | string[] // Column(s) to use for deduplication/merge (supports composite keys)
  mergeStrategy?: 'merge' | 'full_refresh' | 'append' | 'scd_type_2' // Silver: upsert, truncate, append, or SCD Type 2
  updateStrategy?: 'update_all' | 'update_changed' | 'custom' // Which columns to update on merge
  conflictResolution?: 'source_wins' | 'target_wins' | 'most_recent' // How to resolve conflicts
  surrogateKeyStrategy?: 'auto_increment' | 'uuid' | 'hash' | 'use_existing' // How to generate _sk_id
  surrogateKeyColumn?: string // Name of surrogate key column (default: _surrogate_key)
  // SCD Type 2 specific
  scdNaturalKey?: string[] // Natural key for SCD Type 2
  scdEffectiveDateColumn?: string // Effective date column name
  scdEndDateColumn?: string // End date column name
  scdCurrentFlagColumn?: string // Current flag column name
  scdTrackDeletes?: boolean // Track deleted records
  // Gold-specific
  refreshStrategy?: 'full_rebuild' | 'incremental' | 'snapshot' // Gold: full rebuild, incremental, or snapshot
  buildStrategy?: 'full_rebuild' | 'incremental' // Alias for refreshStrategy (used in UI)
  aggregationEnabled?: boolean // Enable aggregation features
  aggregationGroupBy?: string[] // Columns to group by
  aggregationTimeGrain?: 'daily' | 'weekly' | 'monthly' | 'yearly' // Time-based aggregation
  denormalizationEnabled?: boolean // Enable joins with other tables
  materializationType?: 'table' | 'view' | 'materialized_view' // How to materialize Gold layer
  compression?: 'snappy' | 'gzip' | 'zstd' | 'none'
  exportEnabled?: boolean // Enable export to external systems
  exportTargets?: string[] // Export destinations (S3, Snowflake, BigQuery, etc.)
}

// Transformation Configuration
export interface TransformationConfig {
  columnMappings: ColumnMapping[]
  derivedColumns?: DerivedColumn[]
  lookups?: LookupConfig[]
  filters?: FilterConfig[]
  customSql?: string
  useDirectSql: boolean
}

export interface ColumnMapping {
  sourceColumn: string
  targetColumn: string
  dataType: string
  transformations?: ColumnTransformation[]
}

export interface ColumnTransformation {
  type: 'uppercase' | 'lowercase' | 'trim' | 'replace' | 'substring' | 'format' | 'email_normalize' | 'phone_format'
  parameters?: Record<string, any>
}

export interface DerivedColumn {
  name: string
  expression: string
  dataType: string
}

export interface LookupConfig {
  name: string
  sourceTable: string
  joinKeys: JoinKey[]
  selectColumns: string[]
}

export interface JoinKey {
  sourceColumn: string
  targetColumn: string
}

export interface FilterConfig {
  column: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_null'
  value: any
}

// Validation Configuration
export interface ValidationConfig {
  reconciliationRules?: ReconciliationRule[]
  dataQualityRules?: DataQualityRule[]
  notificationEmail?: string
}

export interface ReconciliationRule {
  name: string
  sourceJob: string
  targetJob: string
  reconciliationColumn: string
  tolerance?: number
}

export interface DataQualityRule {
  name: string
  column: string
  ruleType: 'not_null' | 'unique' | 'range' | 'pattern' | 'custom'
  parameters?: Record<string, any>
  severity: 'warning' | 'error'
}

// Job Execution
export interface JobExecution {
  id: string
  jobId: string
  workflowExecutionId: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  duration?: number
  bronzeRecords?: number
  silverRecords?: number
  goldRecords?: number
  validationResults?: ValidationResult[]
  logs: ExecutionLog[]
  error?: string
}

export interface ValidationResult {
  ruleName: string
  status: 'passed' | 'failed' | 'warning'
  message: string
  affectedRecords?: number
}

export interface ExecutionLog {
  timestamp: Date
  level: 'info' | 'warning' | 'error'
  step: 'bronze' | 'silver' | 'gold' | 'validation'
  message: string
}