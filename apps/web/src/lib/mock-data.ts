import { DashboardMetrics, RecentActivity } from '@/types'

// Mock data for dashboard metrics
export const mockDashboardMetrics: DashboardMetrics = {
  runsToday: 24,
  failures: 2,
  dqViolations: 5,
  totalWorkflows: 47,
  activeWorkflows: 31,
  lastUpdated: new Date()
}

// Mock data for recent activities
export const mockRecentActivities: RecentActivity[] = [
  {
    id: '1',
    type: 'workflow_completed',
    workflowName: 'Data Pipeline ETL',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    status: 'success',
    message: 'Successfully processed 15,234 records'
  },
  {
    id: '2',
    type: 'workflow_started',
    workflowName: 'Customer Data Sync',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    status: 'running'
  },
  {
    id: '3',
    type: 'workflow_failed',
    workflowName: 'Inventory Update',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    status: 'failed',
    message: 'Connection timeout to external API'
  },
  {
    id: '4',
    type: 'workflow_completed',
    workflowName: 'Daily Report Generation',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'success'
  },
  {
    id: '5',
    type: 'workflow_started',
    workflowName: 'Security Audit Scan',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    status: 'running'
  }
]

// Mock data for workflow execution trends (last 7 days)
export const mockWorkflowTrends = [
  { name: 'Mon', executions: 45, failures: 2, success: 43 },
  { name: 'Tue', executions: 52, failures: 1, success: 51 },
  { name: 'Wed', executions: 38, failures: 4, success: 34 },
  { name: 'Thu', executions: 61, failures: 3, success: 58 },
  { name: 'Fri', executions: 47, failures: 2, success: 45 },
  { name: 'Sat', executions: 32, failures: 1, success: 31 },
  { name: 'Sun', executions: 24, failures: 2, success: 22 }
]

// Mock data for workflow performance over time (last 24 hours)
export const mockPerformanceData = [
  { name: '00:00', responseTime: 245, throughput: 87 },
  { name: '02:00', responseTime: 198, throughput: 92 },
  { name: '04:00', responseTime: 167, throughput: 95 },
  { name: '06:00', responseTime: 234, throughput: 89 },
  { name: '08:00', responseTime: 445, throughput: 76 },
  { name: '10:00', responseTime: 387, throughput: 82 },
  { name: '12:00', responseTime: 298, throughput: 88 },
  { name: '14:00', responseTime: 356, throughput: 85 },
  { name: '16:00', responseTime: 267, throughput: 91 },
  { name: '18:00', responseTime: 198, throughput: 94 },
  { name: '20:00', responseTime: 234, throughput: 90 },
  { name: '22:00', responseTime: 187, throughput: 96 }
]

// Mock data for workflow status distribution
export const mockStatusDistribution = [
  { name: 'Completed', value: 68, color: '#059669' },
  { name: 'Running', value: 15, color: '#2563eb' },
  { name: 'Failed', value: 8, color: '#dc2626' },
  { name: 'Scheduled', value: 9, color: '#d97706' }
]

// Mock data for system resources
export const mockSystemResources = [
  { name: 'CPU Usage', value: 67, max: 100, color: '#2563eb' },
  { name: 'Memory', value: 84, max: 100, color: '#059669' },
  { name: 'Storage', value: 45, max: 100, color: '#d97706' },
  { name: 'Network', value: 23, max: 100, color: '#7c3aed' }
]

// Generate mini trend data for metric cards
export function generateMiniTrend(length: number = 12): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 100) + 1)
}