"use client"

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  HardDrive,
  Zap,
  AlertCircle,
  BarChart3,
  Calendar,
  Users,
  FileText,
  Loader2,
  Plus,
  type LucideIcon
} from 'lucide-react'
import { OrchestrationService } from '@/lib/services/orchestration-service'
import { formatDistanceToNow } from 'date-fns'
import { CreateWorkflowModal } from '@/components/workflows'

// Type definitions
type SystemStatus = 'operational' | 'degraded' | 'outage'
type ServiceStatus = 'running' | 'available' | 'connected' | 'active' | 'unavailable' | 'error'
type ActivityStatus = 'completed' | 'failed' | 'running' | 'pending'
type KPIColor = 'blue' | 'green' | 'red' | 'purple'

interface ServiceHealth {
  status: ServiceStatus
  responseTime: number
}

interface SystemHealth {
  overall: SystemStatus
  services: {
    prefect: ServiceHealth
    minio: ServiceHealth
    database: ServiceHealth
    queue: ServiceHealth
  }
}

interface KPIValue {
  value: number
  change: number
  changePercent: number
}

interface KPIs {
  activeWorkflows: KPIValue
  successfulRuns: KPIValue
  failedRuns: KPIValue
  dataProcessed: KPIValue & { valueFormatted: string }
}

interface Activity {
  id: string
  workflowName: string
  status: ActivityStatus
  startedAt: string
  duration?: number
  completedJobs: number
  totalJobs: number
}

interface SuccessRateTrend {
  date: string
  total: number
  successful: number
  failed: number
  running: number
  successRate: number
}

interface OverviewMetrics {
  timestamp: string
  systemHealth: SystemHealth
  kpis: KPIs
  recentActivity: Activity[]
  successRateTrends: SuccessRateTrend[]
}

export default function OverviewPage() {
  const [metrics, setMetrics] = React.useState<OverviewMetrics | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = React.useState(false)

  const loadMetrics = React.useCallback(async () => {
    try {
      const data = await OrchestrationService.getOverviewMetrics()
      setMetrics(data)
      setError(null)
    } catch (err) {
      console.error('Failed to load overview metrics:', err)
      setError('Failed to load overview metrics')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    loadMetrics()

    // Auto-refresh every 30 seconds
    const interval = setInterval(loadMetrics, 30000)
    return () => clearInterval(interval)
  }, [loadMetrics])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground-muted">Loading overview metrics...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Error Loading Metrics</h3>
            <p className="text-sm text-foreground-muted mb-4">{error}</p>
            <button
              onClick={loadMetrics}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!metrics) {
    return null
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header with CTA */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orchestration Overview</h1>
          <p className="text-foreground-muted mt-1">
            Real-time monitoring and analytics for your data pipelines
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-foreground-muted">
            Last updated: {formatDistanceToNow(new Date(metrics.timestamp), { addSuffix: true })}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </button>
        </div>
      </div>

      {/* System Health Status */}
      <SystemHealthStatus health={metrics.systemHealth} />

      {/* Hero KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard
          title="Active Workflows"
          value={metrics.kpis.activeWorkflows.value}
          change={metrics.kpis.activeWorkflows.change}
          changePercent={metrics.kpis.activeWorkflows.changePercent}
          icon={Activity}
          color="blue"
        />
        <KPICard
          title="Successful Runs (24h)"
          value={metrics.kpis.successfulRuns.value}
          change={metrics.kpis.successfulRuns.change}
          changePercent={metrics.kpis.successfulRuns.changePercent}
          icon={CheckCircle}
          color="green"
        />
        <KPICard
          title="Failed Runs (24h)"
          value={metrics.kpis.failedRuns.value}
          change={metrics.kpis.failedRuns.change}
          changePercent={metrics.kpis.failedRuns.changePercent}
          icon={XCircle}
          color="red"
          invertTrend
        />
        <KPICard
          title="Data Processed (24h)"
          value={metrics.kpis.dataProcessed.valueFormatted}
          change={metrics.kpis.dataProcessed.change}
          changePercent={metrics.kpis.dataProcessed.changePercent}
          icon={Database}
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Stream */}
        <RecentActivityStream activities={metrics.recentActivity} onCreateClick={() => setShowCreateModal(true)} />

        {/* Success Rate Trends */}
        <SuccessRateTrends trends={metrics.successRateTrends} />
      </div>

      {/* Coming Soon - Phase 2 & 3 Features */}
      <ComingSoonFeatures />

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
      />
    </div>
  )
}

// System Health Status Component
function SystemHealthStatus({ health }: { health: SystemHealth }) {
  const statusColors: Record<SystemStatus, string> = {
    operational: 'bg-green-500',
    degraded: 'bg-yellow-500',
    outage: 'bg-red-500'
  }

  const statusText: Record<SystemStatus, string> = {
    operational: 'All Systems Operational',
    degraded: 'Some Systems Degraded',
    outage: 'System Outage'
  }

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <div className={`w-3 h-3 rounded-full ${statusColors[health.overall]}`} />
            System Health
          </CardTitle>
          <Badge variant={health.overall === 'operational' ? 'success' : health.overall === 'degraded' ? 'default' : 'destructive'}>
            {statusText[health.overall]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ServiceStatus
            name="Prefect Server"
            status={health.services.prefect.status}
            responseTime={health.services.prefect.responseTime}
            icon={Zap}
          />
          <ServiceStatus
            name="MinIO Storage"
            status={health.services.minio.status}
            responseTime={health.services.minio.responseTime}
            icon={HardDrive}
          />
          <ServiceStatus
            name="Database"
            status={health.services.database.status}
            responseTime={health.services.database.responseTime}
            icon={Database}
          />
          <ServiceStatus
            name="Work Queue"
            status={health.services.queue.status}
            responseTime={health.services.queue.responseTime}
            icon={Activity}
          />
        </div>
      </CardContent>
    </Card>
  )
}

interface ServiceStatusProps {
  name: string
  status: ServiceStatus
  responseTime: number
  icon: LucideIcon
}

function ServiceStatus({ name, status, responseTime, icon: Icon }: ServiceStatusProps) {
  const isHealthy = status === 'running' || status === 'available' || status === 'connected' || status === 'active'
  const statusColor = isHealthy ? 'text-green-600' : 'text-red-600'
  const bgColor = isHealthy ? 'bg-green-50' : 'bg-red-50'

  return (
    <div className={`p-3 rounded-lg ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${statusColor}`} />
        <span className="text-xs font-medium text-foreground">{name}</span>
      </div>
      <div className={`text-xs font-semibold ${statusColor}`}>
        {isHealthy ? '✓' : '✗'} {status}
      </div>
      {responseTime > 0 && (
        <div className="text-xs text-foreground-muted mt-1">{responseTime}ms</div>
      )}
    </div>
  )
}

// KPI Card Component
interface KPICardProps {
  title: string
  value: number | string
  change: number
  changePercent: number
  icon: LucideIcon
  color: KPIColor
  invertTrend?: boolean
}

function KPICard({ title, value, change, changePercent, icon: Icon, color, invertTrend = false }: KPICardProps) {
  const isPositive = invertTrend ? change < 0 : change > 0
  const isNegative = invertTrend ? change > 0 : change < 0

  const colorClasses: Record<KPIColor, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600'
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        <div className="text-3xl font-bold text-foreground mb-1">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>
        <div className="text-sm text-foreground-muted mb-3">{title}</div>
        {change !== 0 && (
          <div className="flex items-center gap-1 text-xs">
            {isPositive ? (
              <TrendingUp className="w-4 h-4 text-green-600" />
            ) : isNegative ? (
              <TrendingDown className="w-4 h-4 text-red-600" />
            ) : null}
            <span className={isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-foreground-muted'}>
              {change > 0 ? '+' : ''}{change} ({changePercent > 0 ? '+' : ''}{changePercent.toFixed(1)}%)
            </span>
            <span className="text-foreground-muted">from yesterday</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Recent Activity Stream Component
interface RecentActivityStreamProps {
  activities: Activity[]
  onCreateClick: () => void
}

function RecentActivityStream({ activities, onCreateClick }: RecentActivityStreamProps) {
  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Recent Activity
          <Badge variant="secondary" className="ml-auto">Last 50 Executions</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <div className="space-y-2">
          {activities.length === 0 ? (
            <div className="text-center py-12 text-foreground-muted">
              <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Executions Yet</h3>
              <p className="text-sm mb-6">Create your first workflow to start orchestrating data pipelines</p>
              <button
                onClick={onCreateClick}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Create Your First Workflow
              </button>
            </div>
          ) : (
            activities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface ActivityItemProps {
  activity: Activity
}

function ActivityItem({ activity }: ActivityItemProps) {
  const statusConfig: Record<ActivityStatus, { icon: LucideIcon; color: string; bg: string }> = {
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50' },
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' }
  }

  const config = statusConfig[activity.status]
  const StatusIcon = config.icon

  return (
    <div className={`p-3 rounded-lg ${config.bg} hover:opacity-80 transition-opacity cursor-pointer`}>
      <div className="flex items-start gap-3">
        <StatusIcon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5 ${activity.status === 'running' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-medium text-foreground text-sm truncate">{activity.workflowName}</span>
            <span className="text-xs text-foreground-muted whitespace-nowrap">
              {activity.startedAt && formatDistanceToNow(new Date(activity.startedAt), { addSuffix: true })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Badge variant={activity.status === 'completed' ? 'success' : activity.status === 'failed' ? 'destructive' : 'default'} className="text-[10px] px-1.5 py-0">
              {activity.status}
            </Badge>
            {activity.duration && (
              <span>{formatDuration(activity.duration)}</span>
            )}
            {activity.totalJobs > 0 && (
              <span>{activity.completedJobs}/{activity.totalJobs} jobs</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Success Rate Trends Component
interface SuccessRateTrendsProps {
  trends: SuccessRateTrend[]
}

function SuccessRateTrends({ trends }: SuccessRateTrendsProps) {
  const maxValue = Math.max(...trends.map(t => t.total), 1)
  const avgSuccessRate = trends.reduce((sum, t) => sum + t.successRate, 0) / trends.length

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Success Rate Trends
          <Badge variant="secondary" className="ml-auto">Last 7 Days</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="mb-6">
          <div className="text-4xl font-bold text-foreground">{avgSuccessRate.toFixed(1)}%</div>
          <div className="text-sm text-foreground-muted">Average Success Rate</div>
        </div>

        <div className="space-y-3">
          {trends.map((trend, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground-muted font-medium">
                  {new Date(trend.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-foreground">{trend.total} runs</span>
                  <span className={trend.successRate >= 90 ? 'text-green-600' : trend.successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                    {trend.successRate.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full flex">
                  <div
                    className="bg-green-500"
                    style={{ width: `${(trend.successful / maxValue) * 100}%` }}
                  />
                  <div
                    className="bg-red-500"
                    style={{ width: `${(trend.failed / maxValue) * 100}%` }}
                  />
                  <div
                    className="bg-blue-500"
                    style={{ width: `${(trend.running / maxValue) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span className="text-foreground-muted">Successful</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-500 rounded-sm" />
            <span className="text-foreground-muted">Failed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm" />
            <span className="text-foreground-muted">Running</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Coming Soon Features Component
function ComingSoonFeatures() {
  const comingSoonFeatures = [
    {
      title: 'Top Workflows by Activity',
      description: 'Most executed workflows with success rates and average duration',
      icon: Users,
      phase: 'Phase 2'
    },
    {
      title: 'Medallion Architecture Storage',
      description: 'Bronze/Silver/Gold layer storage metrics and data volume trends',
      icon: HardDrive,
      phase: 'Phase 2'
    },
    {
      title: 'Active Alerts & Issues',
      description: 'Real-time alerts for failures, performance degradation, and capacity warnings',
      icon: AlertCircle,
      phase: 'Phase 2'
    },
    {
      title: 'Execution Duration Analysis',
      description: 'Performance trends and outlier detection across workflows',
      icon: BarChart3,
      phase: 'Phase 3'
    },
    {
      title: 'Scheduled Workflows Calendar',
      description: 'Timeline view of upcoming scheduled workflow executions',
      icon: Calendar,
      phase: 'Phase 3'
    },
    {
      title: 'Data Lineage Preview',
      description: 'Visual representation of data flow through medallion architecture',
      icon: FileText,
      phase: 'Phase 3'
    }
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Coming Soon</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {comingSoonFeatures.map((feature, index) => (
          <Card key={index} className="border-dashed border-2 border-gray-300 bg-gray-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gray-200">
                  <feature.icon className="w-5 h-5 text-gray-600" />
                </div>
                <Badge variant="secondary" className="text-xs">{feature.phase}</Badge>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground-muted">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Helper function to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
