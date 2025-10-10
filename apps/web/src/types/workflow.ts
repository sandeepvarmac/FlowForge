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
  loadStrategy?: 'append' | 'overwrite' // Bronze: timestamp-based append or overwrite
  auditColumns?: boolean // Add _ingested_at, _source_file, _row_number
  // Silver-specific
  primaryKey?: string // Column to use for deduplication/merge
  mergeStrategy?: 'merge' | 'full_refresh' | 'append' // Silver: upsert, truncate, or append
  surrogateKeyStrategy?: 'auto_increment' | 'uuid' | 'use_existing' // How to generate _sk_id
  // Gold-specific
  refreshStrategy?: 'incremental' | 'full_rebuild' // Gold: incremental or full
  compression?: 'snappy' | 'gzip' | 'zstd' | 'none'
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