/**
 * Pipeline and Source Types for FlowForge
 *
 * Terminology:
 * - Pipeline: A container for related data sources (formerly "Workflow")
 * - Source: An individual data ingestion task (formerly "Job")
 */

// Pipeline Mode - determines how sources/jobs are organized
export type PipelineMode = 'source-centric' | 'layer-centric'

export interface Pipeline {
  id: string
  name: string
  description?: string
  application: string
  owner: string
  status: PipelineStatus
  type: PipelineType
  mode: PipelineMode // Pipeline architecture mode
  sources: Source[]
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
    completedSources: number
    failedSources: number
    totalSources: number
  } | null
}

export type PipelineStatus =
  | 'manual'
  | 'scheduled'
  | 'dependency'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'

export type PipelineType =
  | 'manual'
  | 'scheduled'
  | 'event-driven'

export interface PipelineFormData {
  name: string
  description: string
  application: string
  businessUnit: string
  team: string
  pipelineType: PipelineType
  pipelineMode?: PipelineMode // Optional, defaults to 'source-centric'
  environment?: 'dev' | 'qa' | 'prod'
  dataClassification?: 'public' | 'internal' | 'confidential' | 'pii'
  priority?: 'critical' | 'high' | 'medium' | 'low'
  notificationEmail?: string
  tags?: string[]
  retentionDays?: number
}

export interface PipelineExecution {
  id: string
  pipelineId: string
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

// =============================================================================
// LAYER-CENTRIC MODE TYPES (Dataset Jobs)
// =============================================================================

// Dataset status in the metadata catalog (for dependency tracking)
export type DatasetStatus = 'pending' | 'running' | 'ready' | 'failed'

// Target layer for dataset jobs
export type TargetLayer = 'bronze' | 'silver' | 'gold'

// Input dataset reference (for Silver/Gold dataset jobs)
export interface InputDatasetRef {
  tableName: string // Name in metadata catalog
  layer: TargetLayer // Source layer (bronze for Silver jobs, silver for Gold jobs)
  catalogId?: string // Optional catalog ID for direct reference
}

// Dataset Job configuration (for layer-centric mode)
export interface DatasetJobConfig {
  targetLayer: TargetLayer // Which layer this job produces
  inputDatasets?: InputDatasetRef[] // Input datasets (for Silver/Gold jobs)
  transformSql?: string // SQL transform definition
  outputTableName: string // Output table name in the target layer
}

// =============================================================================
// SOURCE TYPES
// =============================================================================

// Source Types for EDP Architecture (formerly Job)
export interface Source {
  id: string
  pipelineId: string
  name: string
  description?: string
  type: SourceType
  order: number
  sourceConfig: DataSourceConfig
  destinationConfig: DestinationConfig
  transformationConfig?: TransformationConfig
  validationConfig?: ValidationConfig
  status: SourceStatus
  lastRun?: Date
  createdAt: Date
  updatedAt: Date
  // Layer-centric / Dataset Job fields
  isDatasetJob?: boolean // True if this is a layer-centric dataset job
  datasetJobConfig?: DatasetJobConfig // Configuration for dataset jobs
}

export type SourceType =
  | 'file-based'
  | 'database'
  | 'nosql'
  | 'api'
  | 'gold-analytics' // Special type for Gold layer that reads from multiple Silver tables
  | 'dataset-job' // Layer-centric mode: Dataset Job that operates on a specific layer

export type SourceStatus =
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
  // Storage connection reference (for file sources from storage connections)
  storageConnectionId?: string
  // Incremental loading support (for temporal columns in CSV)
  isIncremental?: boolean
  deltaColumn?: string
  lastWatermark?: string | Date
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

// Landing Zone Configuration
export interface LandingZoneConfig {
  enabled: boolean
  pathPattern: string
  fileOrganization: 'date-partitioned' | 'source-partitioned' | 'flat'
  retentionDays: number
  immutable: boolean
}

// Column Mapping for Bronze layer
export interface BronzeColumnMapping {
  sourceColumn: string
  targetColumn: string
  targetType: string
  exclude: boolean
}

// Destination Configuration (Landing/Bronze/Silver/Gold)
export interface DestinationConfig {
  landingZoneConfig?: LandingZoneConfig
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
  schemaEvolution?: 'strict' | 'add_new_columns' | 'ignore_extra'
  // Bronze load mode
  loadMode?: 'overwrite' | 'append'
  // Bronze quarantine configuration
  quarantineEnabled?: boolean
  quarantineTableName?: string
  // Bronze column mapping
  columnMapping?: BronzeColumnMapping[]
  // Silver-specific
  primaryKey?: string | string[] // Column(s) to use for deduplication/merge (supports composite keys)
  mergeStrategy?: 'merge' | 'full_refresh' | 'append' | 'scd_type_2' // Silver: upsert, truncate, append, or SCD Type 2
  updateStrategy?: 'update_all' | 'update_changed' | 'custom' // Which columns to update on merge
  conflictResolution?: 'source_wins' | 'target_wins' | 'most_recent' // How to resolve conflicts
  surrogateKeyStrategy?: 'auto_increment' | 'uuid' | 'hash' | 'use_existing' // How to generate _sk_id
  surrogateKeyColumn?: string // Name of surrogate key column (default: _surrogate_key)
  // AI-suggested deduplication settings
  _dedupEnabled?: boolean // Enable advanced deduplication (AI-suggested)
  _dedupStrategy?: 'first' | 'last' | 'none' // Deduplication strategy (AI-suggested)
  _dedupSortColumn?: string // Sort column for deduplication (AI-suggested)
  _partitionStrategy?: string // Partition strategy (AI-suggested from Bronze)
  _partitionColumn?: string // Partition column (AI-suggested from Bronze)
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
  sourceId: string
  targetId: string
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

// Source Execution (formerly Job Execution)
export interface SourceExecution {
  id: string
  sourceId: string
  pipelineExecutionId: string
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

// AI Suggestion Types
export interface AIFullAnalysisResult {
  success: boolean
  bronze: BronzeSuggestions
  silver: SilverSuggestions
  gold: GoldSuggestions
  analysisSummary: {
    status: 'started' | 'completed' | 'partial' | 'failed'
    progress: number
    events: AIAnalysisEvent[]
    error?: string
  }
  providerUsed?: 'anthropic' | 'openai' | 'unknown'
  progressEvents?: AIProgressEvent[]
}

export interface AIProgressEvent {
  type: 'progress'
  stage: string
  message: string
}

export interface AIAnalysisEvent {
  stage: string
  status: string
  timestamp: string
  message?: string
}

export interface BronzeSuggestions {
  incremental_load?: {
    enabled: boolean
    strategy?: string
    watermark_column?: string
    reasoning?: string
  }
  partitioning?: {
    enabled: boolean
    columns?: string[]
    reasoning?: string
  }
  schema_evolution?: {
    enabled: boolean
    mode?: string
    reasoning?: string
  }
}

export interface SilverSuggestions {
  primary_key?: {
    columns: string[]
    reasoning?: string
  }
  deduplication?: {
    enabled: boolean
    strategy?: string
    reasoning?: string
  }
  merge_strategy?: {
    type: string
    reasoning?: string
  }
  quality_rules?: {
    rules: any[]
    reasoning?: string
  }
}

export interface GoldSuggestions {
  aggregations?: {
    recommended_dimensions: string[]
    recommended_metrics: string[]
    reasoning?: string
  }
  business_keys?: {
    keys: string[]
    reasoning?: string
  }
  semantic_naming?: {
    suggestions: Record<string, string>
    reasoning?: string
  }
  metrics?: {
    recommended: string[]
    reasoning?: string
  }
}

export interface AIUsageMetadata {
  applied: boolean
  bronze?: boolean
  silver?: boolean
  gold?: boolean
  providerUsed?: 'anthropic' | 'openai'
  timestamp?: string
}

// =============================================================================
// BACKWARD COMPATIBILITY ALIASES
// These aliases maintain compatibility with existing code during migration
// =============================================================================

/** @deprecated Use Pipeline instead */
export type Workflow = Pipeline
/** @deprecated Use PipelineStatus instead */
export type WorkflowStatus = PipelineStatus
/** @deprecated Use PipelineType instead */
export type WorkflowType = PipelineType
/** @deprecated Use PipelineFormData instead */
export type WorkflowFormData = PipelineFormData
/** @deprecated Use PipelineExecution instead */
export type WorkflowExecution = PipelineExecution

/** @deprecated Use Source instead */
export type Job = Source
/** @deprecated Use SourceType instead */
export type JobType = SourceType
/** @deprecated Use SourceStatus instead */
export type JobStatus = SourceStatus
/** @deprecated Use SourceExecution instead */
export type JobExecution = SourceExecution
