export interface Workflow {
  id: string
  name: string
  description?: string
  application: string
  owner: string
  status: WorkflowStatus
  type: WorkflowType
  lastRun?: Date
  nextRun?: Date
  createdAt: Date
  updatedAt: Date
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
  notificationEmail: string
  tags: string[]
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