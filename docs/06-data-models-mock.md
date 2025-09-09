# Data Models (Mock Types)

```ts
// Core entities (TypeScript-style for clarity)
export type UUID = string;

export interface ConnectionRef {
  id: UUID;
  name: string;
  type: 's3' | 'sqlserver' | 'oracle' | 'postgres' | 'snowflake' | 'api';
  secretId: string; // vault key
  options?: Record<string, unknown>;
}

export interface Workflow {
  id: UUID;
  name: string;
  businessUnit: string;
  description?: string;
  jobs: Job[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type JobType = 'fileIngest' | 'sqlIngest' | 'transform' | 'validate' | 'reconcile' | 'postProcess' | 'publish';

export interface Job {
  id: UUID;
  type: JobType;
  name: string;
  dependsOn?: UUID[];
  config: Record<string, unknown>; // see below per type
}

export interface FileIngestConfig {
  connectionId: UUID; // e.g., s3 bucket/prefix
  pathPattern: string; // glob/regex
  format: 'csv' | 'tsv' | 'xlsx';
  headerRows?: number;
  footerRows?: number;
  encoding?: string;
  schema?: Column[]; // inferred or provided
  target: TableRef; // Bronze target
}

export interface SqlIngestConfig {
  connectionId: UUID;
  mode: 'table' | 'query' | 'procedure';
  object?: string; // table name or proc name
  query?: string;
  parameters?: Record<string, unknown>;
  incremental?: WatermarkConfig;
  target: TableRef; // Bronze/Silver target
}

export interface TransformConfig {
  source: TableRef;
  target: TableRef; // Silver/Gold
  mapping: Mapping[];
  partitions?: string[];
  lookups?: LookupJoin[];
  expressions?: Expression[]; // derived columns
}

export interface ValidateConfig {
  rules: ValidationRule[];
}

export interface ReconcileConfig {
  comparisons: ReconcileRule[];
}

export interface PostProcessConfig {
  scriptRef: string; // location of script/template
  params?: Record<string, unknown>;
}

export interface TableRef {
  catalog: string; // e.g., glue/rest
  namespace: string; // db/schema
  name: string; // table
  format?: 'iceberg' | 'parquet';
}

export interface Column {
  name: string;
  type: string;
  nullable?: boolean;
}

export interface Mapping {
  from: string;
  to: string;
  cast?: string;
}

export interface LookupJoin {
  ref: TableRef;
  on: Array<{ left: string; right: string }>;
  select?: string[];
}

export interface Expression {
  name: string;
  expr: string; // e.g., SQL-ish or DSL
}

export interface ValidationRule {
  id: UUID;
  name: string;
  severity: 'info' | 'warn' | 'error';
  expr: string; // boolean predicate
}

export interface ReconcileRule {
  id: UUID;
  name: string;
  left: { table: TableRef; metric: string };
  right: { table: TableRef; metric: string };
  tolerance?: number;
}

export interface RunSummary {
  id: UUID;
  workflowId: UUID;
  status: 'running' | 'succeeded' | 'failed' | 'canceled';
  startedAt: string;
  endedAt?: string;
  steps: RunStep[];
}

export interface RunStep {
  jobId: UUID;
  name: string;
  status: RunSummary['status'];
  durationMs?: number;
  metrics?: Record<string, number>;
  logsRef?: string; // pointer to log storage
}
```

