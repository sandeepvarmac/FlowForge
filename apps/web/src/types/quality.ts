// Quality Module Types

export interface QualityRule {
  id: number
  rule_id: string
  job_id: string
  rule_name: string
  column_name: string
  rule_type: 'not_null' | 'unique' | 'range' | 'pattern' | 'enum' | 'custom'
  parameters: string // JSON string
  severity: 'error' | 'warning' | 'info'
  is_active: boolean
  confidence?: number
  current_compliance?: string
  reasoning?: string
  ai_generated: boolean
  created_at: number
  updated_at: number
}

export interface RuleExecution {
  id: number
  rule_id: number
  job_execution_id: string
  execution_time: number
  status: 'passed' | 'failed' | 'error'
  records_checked: number
  records_passed: number
  records_failed: number
  pass_percentage: number
  error_message?: string
  failed_records_sample?: string // JSON string
}

export interface QuarantineRecord {
  id: number
  rule_id: number
  job_execution_id: string
  record_data: string // JSON string
  failure_reason: string
  quarantine_status: 'quarantined' | 'approved' | 'rejected' | 'fixed'
  reviewer?: string
  review_timestamp?: number
  created_at: number
}

export interface QualityDashboard {
  totalRules: number
  activeRules: number
  aiGeneratedRules: number
  overallQualityScore: number
  recentExecutions: RuleExecution[]
  quarantinedRecords: number
}

export type RuleTypeLabel = {
  [key in QualityRule['rule_type']]: string
}

export const RULE_TYPE_LABELS: RuleTypeLabel = {
  not_null: 'Not Null',
  unique: 'Unique',
  range: 'Range',
  pattern: 'Pattern',
  enum: 'Enum',
  custom: 'Custom SQL'
}

export type SeverityColor = {
  [key in QualityRule['severity']]: string
}

export const SEVERITY_COLORS: SeverityColor = {
  error: 'red',
  warning: 'yellow',
  info: 'blue'
}
