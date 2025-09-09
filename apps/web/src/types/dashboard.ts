export interface DashboardMetrics {
  runsToday: number
  failures: number
  dqViolations: number
  totalWorkflows: number
  activeWorkflows: number
  lastUpdated: Date
}

export interface MetricCard {
  title: string
  value: number | string
  change?: number
  changeType?: 'increase' | 'decrease'
  icon?: string
}

export interface RecentActivity {
  id: string
  type: 'workflow_completed' | 'workflow_failed' | 'workflow_started'
  workflowName: string
  timestamp: Date
  status: string
  message?: string
}