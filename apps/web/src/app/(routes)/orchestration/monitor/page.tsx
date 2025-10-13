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
            Real-time monitoring and performance analytics for all workflow executions
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
                      placeholder="Search by workflow name or execution ID..."
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

                  {/* Workflow Filter */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">Workflows</label>
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

          {/* Executions List */}
          <ExecutionsList
            executions={executions}
            selectedExecution={selectedExecution}
            onSelectExecution={setSelectedExecution}
          />

          {/* Execution Details Panel */}
          {selectedExecution && (
            <ExecutionDetailsPanel
              executionDetails={executionDetails}
              loading={loadingDetails}
              onClose={() => setSelectedExecution(null)}
            />
          )}
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
function ExecutionsList({ executions, selectedExecution, onSelectExecution }: any) {
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
    <div className="space-y-3">
      {executions.map((execution: any) => (
        <ExecutionCard
          key={execution.id}
          execution={execution}
          isSelected={selectedExecution === execution.id}
          onSelect={onSelectExecution}
        />
      ))}
    </div>
  )
}

// Execution Card Component
function ExecutionCard({ execution, isSelected, onSelect }: any) {
  const statusConfig: any = {
    running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50', spin: true },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', spin: false },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50', spin: false },
    cancelled: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50', spin: false }
  }

  const config = statusConfig[execution.status] || statusConfig.completed
  const StatusIcon = config.icon

  const progress = execution.total_jobs > 0
    ? (execution.completed_jobs / execution.total_jobs) * 100
    : 0

  const handleClick = () => {
    // Toggle: if already selected, deselect; otherwise select
    onSelect(isSelected ? null : execution.id)
  }

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-lg ${
        isSelected ? 'ring-2 ring-primary shadow-brand' : ''
      }`}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={`p-3 rounded-lg ${config.bg}`}>
            <StatusIcon className={`w-6 h-6 ${config.color} ${config.spin ? 'animate-spin' : ''}`} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground text-lg truncate">
                  {execution.workflow_name}
                </h3>
                <p className="text-sm text-foreground-muted">
                  Execution ID: {execution.id}
                </p>
              </div>
              <Badge variant={execution.status === 'completed' ? 'success' : execution.status === 'failed' ? 'destructive' : 'default'}>
                {execution.status}
              </Badge>
            </div>

            {/* Metrics */}
            <div className="flex items-center gap-4 text-sm text-foreground-muted mb-3">
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {execution.started_at && formatDistanceToNow(new Date(execution.started_at), { addSuffix: true })}
              </div>
              {execution.duration_ms && (
                <div className="flex items-center gap-1">
                  <Timer className="w-4 h-4" />
                  {formatDuration(execution.duration_ms)}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Activity className="w-4 h-4" />
                {execution.completed_jobs}/{execution.total_jobs} jobs
              </div>
              {execution.total_records_processed > 0 && (
                <div className="flex items-center gap-1">
                  <Database className="w-4 h-4" />
                  {formatNumber(execution.total_records_processed)} records
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {execution.status === 'running' && execution.total_jobs > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-foreground-muted">
                  <span>Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Failed Jobs Indicator */}
            {execution.failed_jobs > 0 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                {execution.failed_jobs} job{execution.failed_jobs > 1 ? 's' : ''} failed
              </div>
            )}
          </div>

          {/* Expand Icon */}
          <ChevronRight className={`w-5 h-5 text-foreground-muted transition-transform ${isSelected ? 'rotate-90' : ''}`} />
        </div>
      </CardContent>
    </Card>
  )
}

// Execution Details Panel Component
function ExecutionDetailsPanel({ executionDetails, loading, onClose }: any) {
  if (loading || !executionDetails) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-foreground-muted">Loading execution details...</p>
        </CardContent>
      </Card>
    )
  }

  const { execution, jobExecutions, metrics } = executionDetails

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">Execution Details</CardTitle>
            <p className="text-sm text-foreground-muted mt-1">
              {execution.workflow_name} • {execution.id}
            </p>
          </div>
          <div className="text-xs text-foreground-muted">
            Click the execution card to collapse
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        {/* Aggregate Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-background-tertiary">
            <div className="text-2xl font-bold text-foreground">{metrics.totalJobs}</div>
            <div className="text-sm text-foreground-muted">Total Jobs</div>
          </div>
          <div className="p-4 rounded-lg bg-green-50">
            <div className="text-2xl font-bold text-green-600">{metrics.completedJobs}</div>
            <div className="text-sm text-foreground-muted">Completed</div>
          </div>
          <div className="p-4 rounded-lg bg-red-50">
            <div className="text-2xl font-bold text-red-600">{metrics.failedJobs}</div>
            <div className="text-sm text-foreground-muted">Failed</div>
          </div>
          <div className="p-4 rounded-lg bg-background-tertiary">
            <div className="text-2xl font-bold text-foreground">{formatNumber(metrics.totalRecordsProcessed)}</div>
            <div className="text-sm text-foreground-muted">Records</div>
          </div>
        </div>

        {/* Medallion Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border-2 border-yellow-300 bg-yellow-50">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-yellow-700" />
              <span className="text-sm font-medium text-yellow-700">Bronze</span>
            </div>
            <div className="text-xl font-bold text-yellow-700">{formatNumber(metrics.totalBronzeRecords)}</div>
            <div className="text-xs text-yellow-600">Raw records</div>
          </div>
          <div className="p-4 rounded-lg border-2 border-blue-300 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <span className="text-sm font-medium text-blue-700">Silver</span>
            </div>
            <div className="text-xl font-bold text-blue-700">{formatNumber(metrics.totalSilverRecords)}</div>
            <div className="text-xs text-blue-600">Cleaned records</div>
          </div>
          <div className="p-4 rounded-lg border-2 border-purple-300 bg-purple-50">
            <div className="flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-purple-700" />
              <span className="text-sm font-medium text-purple-700">Gold</span>
            </div>
            <div className="text-xl font-bold text-purple-700">{formatNumber(metrics.totalGoldRecords)}</div>
            <div className="text-xs text-purple-600">Curated records</div>
          </div>
        </div>

        {/* Job Executions Timeline */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">Job Execution Timeline</h3>
          <div className="space-y-3">
            {jobExecutions.map((jobExec: any) => (
              <JobExecutionItem key={jobExec.id} jobExecution={jobExec} />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Job Execution Item Component
function JobExecutionItem({ jobExecution }: any) {
  const statusConfig: any = {
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    failed: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
    running: { icon: Loader2, color: 'text-blue-600', bg: 'bg-blue-50' },
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-50' }
  }

  const config = statusConfig[jobExecution.status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className={`p-4 rounded-lg border-2 ${jobExecution.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-border bg-background-secondary'}`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${config.bg}`}>
          <StatusIcon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h4 className="font-medium text-foreground">{jobExecution.job_name}</h4>
              <p className="text-sm text-foreground-muted">{jobExecution.job_type}</p>
            </div>
            <Badge variant={jobExecution.status === 'completed' ? 'success' : jobExecution.status === 'failed' ? 'destructive' : 'default'}>
              {jobExecution.status}
            </Badge>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {jobExecution.duration_ms && (
              <div>
                <span className="text-foreground-muted">Duration:</span>
                <span className="ml-1 font-medium text-foreground">{formatDuration(jobExecution.duration_ms)}</span>
              </div>
            )}
            {jobExecution.records_processed > 0 && (
              <div>
                <span className="text-foreground-muted">Records:</span>
                <span className="ml-1 font-medium text-foreground">{formatNumber(jobExecution.records_processed)}</span>
              </div>
            )}
            {jobExecution.bronze_records > 0 && (
              <div>
                <span className="text-foreground-muted">Bronze:</span>
                <span className="ml-1 font-medium text-foreground">{formatNumber(jobExecution.bronze_records)}</span>
              </div>
            )}
            {jobExecution.silver_records > 0 && (
              <div>
                <span className="text-foreground-muted">Silver:</span>
                <span className="ml-1 font-medium text-foreground">{formatNumber(jobExecution.silver_records)}</span>
              </div>
            )}
          </div>

          {jobExecution.error_message && (
            <div className="mt-2 p-2 rounded bg-red-100 border border-red-200">
              <p className="text-sm text-red-700 font-mono">{jobExecution.error_message}</p>
            </div>
          )}
        </div>
      </div>
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
            Duration by Workflow
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
