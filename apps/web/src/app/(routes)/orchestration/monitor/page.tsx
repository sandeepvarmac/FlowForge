"use client"

import * as React from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Layers,
  Database,
  Timer,
  ChevronDown,
  ChevronRight,
  Calendar,
  GitBranch,
  Zap
} from 'lucide-react'
import { MonitorService } from '@/lib/services/monitor-service'
import { formatDistanceToNow } from 'date-fns'

export default function MonitorPage() {
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = React.useState<'executions' | 'performance'>('executions')
  const [executions, setExecutions] = React.useState<any[]>([])
  const [stats, setStats] = React.useState<any>(null)
  const [workflows, setWorkflows] = React.useState<any[]>([])
  const [loading, setLoading] = React.useState(true)
  const [autoRefresh, setAutoRefresh] = React.useState(true)
  const [refreshInterval, setRefreshInterval] = React.useState(10000) // 10 seconds
  const [selectedExecution, setSelectedExecution] = React.useState<string | null>(null)
  const [executionDetails, setExecutionDetails] = React.useState<any>(null)
  const [loadingDetails, setLoadingDetails] = React.useState(false)

  // Filters
  const [filters, setFilters] = React.useState({
    status: [] as string[],
    workflowIds: [] as string[],
    timeRange: '24h',
    search: ''
  })
  const [showFilters, setShowFilters] = React.useState(false)

  // Performance metrics
  const [performanceMetrics, setPerformanceMetrics] = React.useState<any>(null)
  const [performanceTimeRange, setPerformanceTimeRange] = React.useState('30d')

  const loadExecutions = React.useCallback(async () => {
    try {
      const data = await MonitorService.getExecutions(filters)
      setExecutions(data.executions)
      setStats(data.stats)
      setWorkflows(data.workflows)
    } catch (error) {
      console.error('Failed to load executions:', error)
    } finally {
      setLoading(false)
    }
  }, [filters])

  const loadPerformanceMetrics = React.useCallback(async () => {
    try {
      const data = await MonitorService.getPerformanceMetrics(performanceTimeRange)
      setPerformanceMetrics(data)
    } catch (error) {
      console.error('Failed to load performance metrics:', error)
    }
  }, [performanceTimeRange])

  const loadExecutionDetails = React.useCallback(async (executionId: string) => {
    try {
      setLoadingDetails(true)
      const data = await MonitorService.getExecutionDetails(executionId)
      setExecutionDetails(data)
    } catch (error) {
      console.error('Failed to load execution details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }, [])

  // Handle query parameter for auto-selecting execution
  React.useEffect(() => {
    const executionParam = searchParams.get('execution')
    if (executionParam && !selectedExecution) {
      setSelectedExecution(executionParam)
    }
  }, [searchParams, selectedExecution])

  React.useEffect(() => {
    if (activeTab === 'executions') {
      loadExecutions()
    } else if (activeTab === 'performance') {
      loadPerformanceMetrics()
    }
  }, [activeTab, loadExecutions, loadPerformanceMetrics])

  React.useEffect(() => {
    if (!autoRefresh || activeTab !== 'executions') return

    const interval = setInterval(loadExecutions, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadExecutions, activeTab])

  React.useEffect(() => {
    if (selectedExecution) {
      loadExecutionDetails(selectedExecution)
    }
  }, [selectedExecution, loadExecutionDetails])

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const toggleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status]
    }))
  }

  const toggleWorkflowFilter = (workflowId: string) => {
    setFilters(prev => ({
      ...prev,
      workflowIds: prev.workflowIds.includes(workflowId)
        ? prev.workflowIds.filter(w => w !== workflowId)
        : [...prev.workflowIds, workflowId]
    }))
  }

  const clearFilters = () => {
    setFilters({
      status: [],
      workflowIds: [],
      timeRange: '24h',
      search: ''
    })
  }

  const activeFilterCount = filters.status.length + filters.workflowIds.length + (filters.search ? 1 : 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground-muted">Loading monitor data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Execution Monitor</h1>
          <p className="text-foreground-muted mt-1">
            Real-time monitoring and performance analytics for all pipeline executions
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md border transition-colors ${
              autoRefresh
                ? 'bg-primary text-white border-primary'
                : 'bg-background-secondary border-border text-foreground hover:bg-background-tertiary'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('executions')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'executions'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Activity className="w-4 h-4" />
          Executions
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'performance'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Performance
        </button>
      </div>

      {activeTab === 'executions' ? (
        <>
          {/* Filters Section */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="flex-1 min-w-[300px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                    <input
                      type="text"
                      placeholder="Search by pipeline name or execution ID..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Time Range */}
                <select
                  value={filters.timeRange}
                  onChange={(e) => handleFilterChange('timeRange', e.target.value)}
                  className="px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="1h">Last Hour</option>
                  <option value="6h">Last 6 Hours</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>

                {/* Show Filters Button */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-background-tertiary transition-colors"
                >
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="default" className="ml-1">
                      {activeFilterCount}
                    </Badge>
                  )}
                </button>

                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-primary hover:underline"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">Status</label>
                    <div className="flex flex-wrap gap-2">
                      {['running', 'completed', 'failed', 'cancelled'].map((status) => (
                        <button
                          key={status}
                          onClick={() => toggleStatusFilter(status)}
                          className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                            filters.status.includes(status)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-background-secondary border-border hover:bg-background-tertiary'
                          }`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pipeline Filter */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">Pipelines</label>
                    <div className="max-h-32 overflow-y-auto space-y-2">
                      {workflows.map((workflow: any) => (
                        <label key={workflow.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.workflowIds.includes(workflow.id)}
                            onChange={() => toggleWorkflowFilter(workflow.id)}
                            className="w-4 h-4 text-primary rounded border-border focus:ring-primary"
                          />
                          <span className="text-sm text-foreground">{workflow.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Loader2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.running || 0}</div>
                    <div className="text-sm text-foreground-muted">Running</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-50">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.completed || 0}</div>
                    <div className="text-sm text-foreground-muted">Completed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.failed || 0}</div>
                    <div className="text-sm text-foreground-muted">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-50">
                    <Clock className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-foreground">{stats?.cancelled || 0}</div>
                    <div className="text-sm text-foreground-muted">Cancelled</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Executions List with Inline Details */}
          <ExecutionsList
            executions={executions}
            selectedExecution={selectedExecution}
            onSelectExecution={setSelectedExecution}
            executionDetails={executionDetails}
            loadingDetails={loadingDetails}
          />
        </>
      ) : (
        <PerformanceDashboard
          metrics={performanceMetrics}
          timeRange={performanceTimeRange}
          onTimeRangeChange={setPerformanceTimeRange}
        />
      )}

      {/* Coming Soon Features */}
      <ComingSoonFeatures />
    </div>
  )
}

// Executions List Component
function ExecutionsList({ executions, selectedExecution, onSelectExecution, executionDetails, loadingDetails }: any) {
  if (executions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Activity className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Executions Found</h3>
          <p className="text-sm text-foreground-muted">
            Try adjusting your filters or time range to see more results
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {executions.map((execution: any) => (
        <ExecutionCard
          key={execution.id}
          execution={execution}
          isSelected={selectedExecution === execution.id}
          onSelect={onSelectExecution}
          executionDetails={selectedExecution === execution.id ? executionDetails : null}
          loadingDetails={selectedExecution === execution.id ? loadingDetails : false}
        />
      ))}
    </div>
  )
}

// Execution Card Component with Inline Expandable Details
function ExecutionCard({ execution, isSelected, onSelect, executionDetails, loadingDetails }: any) {
  const statusConfig: any = {
    running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'default', spin: true },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', badge: 'success', spin: false },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', badge: 'destructive', spin: false },
    cancelled: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', badge: 'secondary', spin: false }
  }

  const config = statusConfig[execution.status] || statusConfig.completed
  const StatusIcon = config.icon

  const handleClick = () => {
    onSelect(isSelected ? null : execution.id)
  }

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-background transition-all">
      {/* Card Header - Clickable */}
      <div
        className={`p-3 cursor-pointer hover:bg-background-secondary transition-colors ${isSelected ? 'bg-background-secondary' : ''}`}
        onClick={handleClick}
      >
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div className={`p-2 rounded-lg ${config.bg} shrink-0`}>
            <StatusIcon className={`w-5 h-5 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
          </div>

          {/* Main Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-foreground truncate">
              {execution.pipeline_name || execution.workflow_name || 'Pipeline'}
            </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-foreground-muted mt-0.5 flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {execution.started_at && formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })}
              </span>
              {execution.duration_ms && (
                <span className="flex items-center gap-1">
                  <Timer className="w-3 h-3" />
                  {formatDuration(execution.duration_ms)}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Activity className="w-3 h-3" />
                {execution.completed_jobs}/{execution.total_jobs} jobs
              </span>
            </div>
          </div>

          {/* Status Badge & Chevron */}
          <Badge variant={config.badge} className="shrink-0">
            {execution.status}
          </Badge>
          <ChevronDown className={`w-4 h-4 text-foreground-muted transition-transform shrink-0 ${isSelected ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Inline Expanded Details */}
      {isSelected && (
        <div className="border-t border-border bg-background-secondary">
          {loadingDetails ? (
            <div className="p-4 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-foreground-muted">Loading details...</span>
            </div>
          ) : executionDetails ? (
            <InlineExecutionDetails details={executionDetails} />
          ) : (
            <div className="p-4 text-center text-sm text-foreground-muted">
              No details available
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Compact Inline Execution Details
function InlineExecutionDetails({ details }: { details: any }) {
  const { execution, jobExecutions, metrics } = details
  const [expandedJob, setExpandedJob] = React.useState<string | null>(null)

  return (
    <div className="p-3 space-y-3">
      {/* Compact Metrics Row */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-background text-xs">
          <span className="text-foreground-muted">Jobs:</span>
          <span className="font-medium text-green-600">{metrics.completedJobs}</span>
          <span className="text-foreground-muted">/</span>
          <span className="font-medium">{metrics.totalJobs}</span>
          {metrics.failedJobs > 0 && (
            <span className="text-red-600">({metrics.failedJobs} failed)</span>
          )}
        </div>

        {/* Medallion Layer Stats - Compact with Labels */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 border border-amber-200 text-xs">
          <Layers className="w-3 h-3 text-amber-600" />
          <span className="text-amber-600 font-medium">Bronze:</span>
          <span className="text-amber-700 font-semibold">{formatNumber(metrics.totalBronzeRecords)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 border border-slate-300 text-xs">
          <Layers className="w-3 h-3 text-slate-500" />
          <span className="text-slate-500 font-medium">Silver:</span>
          <span className="text-slate-700 font-semibold">{formatNumber(metrics.totalSilverRecords)}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-yellow-50 border border-yellow-400 text-xs">
          <Layers className="w-3 h-3 text-yellow-600" />
          <span className="text-yellow-600 font-medium">Gold:</span>
          <span className="text-yellow-700 font-semibold">{formatNumber(metrics.totalGoldRecords)}</span>
        </div>
      </div>

      {/* Job Executions - Compact List */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-foreground-muted uppercase tracking-wide">Source Executions</div>
        {jobExecutions.map((jobExec: any) => (
          <CompactJobItem
            key={jobExec.id}
            jobExecution={jobExec}
            isExpanded={expandedJob === jobExec.id}
            onToggle={() => setExpandedJob(expandedJob === jobExec.id ? null : jobExec.id)}
          />
        ))}
      </div>
    </div>
  )
}

// Compact Job Execution Item
function CompactJobItem({ jobExecution, isExpanded, onToggle }: { jobExecution: any, isExpanded: boolean, onToggle: () => void }) {
  const statusConfig: any = {
    completed: { color: 'text-green-600', bg: 'bg-green-500' },
    failed: { color: 'text-red-600', bg: 'bg-red-500' },
    running: { color: 'text-blue-600', bg: 'bg-blue-500' },
    pending: { color: 'text-gray-500', bg: 'bg-gray-400' }
  }
  const config = statusConfig[jobExecution.status] || statusConfig.pending

  return (
    <div className={`rounded border ${jobExecution.status === 'failed' ? 'border-red-200 bg-red-50/50' : 'border-border bg-background'}`}>
      {/* Job Header */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 cursor-pointer hover:bg-background-tertiary"
        onClick={onToggle}
      >
        <div className={`w-2 h-2 rounded-full ${config.bg}`} />
        <span className="text-sm font-medium text-foreground flex-1 truncate">{jobExecution.job_name}</span>

        {/* Inline stats */}
        <div className="flex items-center gap-2 text-xs text-foreground-muted">
          {jobExecution.duration_ms && (
            <span>{formatDuration(jobExecution.duration_ms)}</span>
          )}
          {jobExecution.bronze_records > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">{formatNumber(jobExecution.bronze_records)} Bronze</span>
          )}
          {jobExecution.silver_records > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">{formatNumber(jobExecution.silver_records)} Silver</span>
          )}
          {jobExecution.gold_records > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium">{formatNumber(jobExecution.gold_records)} Gold</span>
          )}
        </div>

        <Badge variant={jobExecution.status === 'completed' ? 'success' : jobExecution.status === 'failed' ? 'destructive' : 'default'} className="text-[10px] px-1.5 py-0">
          {jobExecution.status}
        </Badge>
        <ChevronRight className={`w-3 h-3 text-foreground-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-border text-xs space-y-1">
          {jobExecution.error_message && (
            <div className="p-1.5 rounded bg-red-100 text-red-700 font-mono text-[11px] break-all">
              {jobExecution.error_message}
            </div>
          )}
          {jobExecution.logs && jobExecution.logs.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-foreground-muted">Logs:</span>
              {jobExecution.logs.slice(-5).map((log: string, i: number) => (
                <div key={i} className="text-foreground-muted font-mono text-[11px] truncate">
                  {log}
                </div>
              ))}
            </div>
          )}
          {!jobExecution.error_message && (!jobExecution.logs || jobExecution.logs.length === 0) && (
            <div className="text-foreground-muted">No additional details</div>
          )}
        </div>
      )}
    </div>
  )
}


// Performance Dashboard Component (continued in next part due to length)
function PerformanceDashboard({ metrics, timeRange, onTimeRangeChange }: any) {
  if (!metrics) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground-muted">Loading performance metrics...</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Performance Analysis</h3>
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Resource Efficiency */}
      {metrics.efficiency && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Resource Efficiency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-background-tertiary">
                <div className="text-2xl font-bold text-foreground">{metrics.efficiency.total_executions || 0}</div>
                <div className="text-sm text-foreground-muted">Total Executions</div>
              </div>
              <div className="p-4 rounded-lg bg-background-tertiary">
                <div className="text-2xl font-bold text-foreground">{formatNumber(metrics.efficiency.total_records || 0)}</div>
                <div className="text-sm text-foreground-muted">Total Records</div>
              </div>
              <div className="p-4 rounded-lg bg-background-tertiary">
                <div className="text-2xl font-bold text-foreground">
                  {Math.round(metrics.efficiency.avg_records_per_second || 0)}/s
                </div>
                <div className="text-sm text-foreground-muted">Avg Records/Sec</div>
              </div>
              <div className="p-4 rounded-lg bg-background-tertiary">
                <div className="text-2xl font-bold text-foreground">
                  {formatDuration(metrics.efficiency.avg_job_duration || 0)}
                </div>
                <div className="text-sm text-foreground-muted">Avg Job Duration</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duration by Workflow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Duration by Pipeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.durationByWorkflow?.slice(0, 10).map((workflow: any) => (
              <div key={workflow.workflow_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">{workflow.workflow_name}</span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-foreground-muted">{workflow.execution_count} runs</span>
                    <span className="font-medium text-foreground">{formatDuration(workflow.avg_duration)}</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.min((workflow.avg_duration / metrics.durationByWorkflow[0].avg_duration) * 100, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Failure Analysis */}
      {metrics.failureAnalysis?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Failure Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.failureAnalysis.map((item: any) => (
                <div key={item.workflow_id} className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{item.workflow_name}</span>
                    <Badge variant="destructive">{item.failure_rate.toFixed(1)}% failure rate</Badge>
                  </div>
                  <div className="text-sm text-foreground-muted">
                    {item.failure_count} failed out of {item.total_executions} executions
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Coming Soon Features Component
function ComingSoonFeatures() {
  const features = [
    { title: 'Gantt Chart Timeline', description: 'Visual timeline of job dependencies and execution flow', icon: GitBranch, phase: 'Phase 2' },
    { title: 'Data Lineage Graph', description: 'Interactive visualization of Bronze → Silver → Gold data flow', icon: Layers, phase: 'Phase 2' },
    { title: 'Comparison View', description: 'Compare multiple executions side-by-side', icon: BarChart3, phase: 'Phase 2' },
    { title: 'Alert Integration', description: 'View alerts triggered by executions', icon: AlertCircle, phase: 'Phase 2' },
    { title: 'Anomaly Detection', description: 'AI-powered detection of unusual patterns', icon: Zap, phase: 'Phase 3' },
    { title: 'Execution Replay', description: 'Replay failed executions with debugging', icon: RefreshCw, phase: 'Phase 3' }
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Coming Soon</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
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

// Helper Functions
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
  return num.toString()
}
