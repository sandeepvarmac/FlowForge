/**
 * Workflow Triggers Types
 * Defines types for workflow automation triggers (time-based, dependency-based, event-driven)
 */

export interface WorkflowTrigger {
  id: string
  workflowId: string
  triggerType: TriggerType
  enabled: boolean
  triggerName?: string

  // For scheduled triggers
  cronExpression?: string
  timezone?: string
  nextRunAt?: Date
  lastRunAt?: Date

  // For dependency triggers
  dependsOnWorkflowId?: string
  dependsOnWorkflowName?: string // Populated by API for display
  dependencyCondition?: DependencyCondition
  delayMinutes?: number

  // For event triggers (future)
  eventType?: EventType
  eventConfig?: EventConfig

  createdAt: Date
  updatedAt: Date
}

export type TriggerType =
  | 'manual'      // User-initiated execution
  | 'scheduled'   // Time-based cron scheduling
  | 'dependency'  // Runs after another workflow completes
  | 'event'       // Event-driven (webhooks, file arrival, etc.)

export type DependencyCondition =
  | 'on_success'     // Run only if upstream workflow succeeds
  | 'on_failure'     // Run only if upstream workflow fails
  | 'on_completion'  // Run regardless of upstream workflow status

export type EventType =
  | 'file_arrival'   // New file detected in landing zone
  | 'webhook'        // External webhook triggered
  | 'api_call'       // API endpoint called
  | 's3_event'       // S3 bucket event
  | 'sftp_arrival'   // SFTP file arrival
  | 'database_change' // Database CDC event

export interface EventConfig {
  // For file_arrival
  watchPath?: string
  filePattern?: string

  // For webhook
  webhookUrl?: string
  webhookSecret?: string
  headers?: Record<string, string>

  // For s3_event
  bucketName?: string
  prefix?: string
  suffix?: string

  // For database_change
  tableName?: string
  changeType?: 'insert' | 'update' | 'delete' | 'all'

  // Custom config
  custom?: Record<string, any>
}

// Request types for API
export interface CreateTriggerRequest {
  triggerType: TriggerType
  triggerName?: string
  enabled?: boolean

  // For scheduled triggers
  cronExpression?: string
  timezone?: string

  // For dependency triggers
  dependsOnWorkflowId?: string
  dependencyCondition?: DependencyCondition
  delayMinutes?: number

  // For event triggers
  eventType?: EventType
  eventConfig?: EventConfig
}

export interface UpdateTriggerRequest {
  triggerName?: string
  enabled?: boolean

  // For scheduled triggers
  cronExpression?: string
  timezone?: string

  // For dependency triggers
  dependsOnWorkflowId?: string
  dependencyCondition?: DependencyCondition
  delayMinutes?: number

  // For event triggers
  eventType?: EventType
  eventConfig?: EventConfig
}

// UI-specific types
export interface TriggerFormData {
  triggerType: TriggerType
  triggerName?: string

  // For scheduled triggers
  cronPreset?: CronPreset
  cronExpression?: string
  timezone?: string

  // For dependency triggers
  dependsOnWorkflowId?: string
  dependencyCondition?: DependencyCondition
  delayMinutes?: number

  // For event triggers
  eventType?: EventType
  eventConfig?: EventConfig
}

export type CronPreset =
  | 'hourly'       // 0 * * * *
  | 'daily'        // 0 2 * * * (2 AM daily)
  | 'weekly'       // 0 2 * * 1 (2 AM Monday)
  | 'monthly'      // 0 2 1 * * (2 AM 1st of month)
  | 'custom'       // User-defined cron expression

// Dependency graph types
export interface DependencyNode {
  workflowId: string
  workflowName: string
  triggerId?: string
  condition?: DependencyCondition
}

export interface DependencyGraph {
  upstream: DependencyNode[]    // Workflows that trigger this workflow
  downstream: DependencyNode[]  // Workflows triggered by this workflow
}

// Trigger validation types
export interface TriggerValidationResult {
  valid: boolean
  error?: string
  warning?: string
  chain?: string[] // Dependency chain for circular dependency detection
}

// Trigger execution history
export interface TriggerExecutionHistory {
  triggerId: string
  executionId: string
  triggeredAt: Date
  status: 'completed' | 'failed' | 'running' | 'cancelled'
  duration?: number
  error?: string
}

// Cron helper types
export interface CronSchedule {
  minute: string    // 0-59
  hour: string      // 0-23
  dayOfMonth: string // 1-31
  month: string     // 1-12
  dayOfWeek: string // 0-7 (0 and 7 are Sunday)
}

export interface NextRunPreview {
  nextRuns: Date[]
  cronExpression: string
  timezone: string
  description: string
}
