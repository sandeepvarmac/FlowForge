"use client"

import * as React from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input, useToast, DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui'
import { CreateWorkflowModal } from '@/components/workflows/create-workflow-modal'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { TriggersService } from '@/lib/services/triggers-service'
import type { WorkflowTrigger } from '@/types/trigger'
import { Search, Filter, MoreVertical, Play, Pause, Settings, Loader2, Eye, Trash2, Clock, Zap, Calendar, ChevronLeft, ChevronRight, Copy, Download, GitBranch, X } from 'lucide-react'
import type { WorkflowFormData } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'completed':
      return 'success'
    case 'scheduled':
      return 'default'
    case 'running':
      return 'default'
    case 'manual':
      return 'secondary'
    case 'dependency':
      return 'default'
    case 'paused':
      return 'warning'
    case 'failed':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const getEnvironmentVariant = (env: string) => {
  switch (env) {
    case 'prod':
    case 'production':
      return 'destructive'
    case 'uat':
      return 'warning'
    case 'qa':
      return 'default'
    case 'dev':
    case 'development':
      return 'secondary'
    default:
      return 'secondary'
  }
}

const getEnvironmentLabel = (env: string) => {
  switch (env) {
    case 'prod':
      return 'PRODUCTION'
    case 'uat':
      return 'UAT'
    case 'qa':
      return 'QA'
    case 'dev':
      return 'DEVELOPMENT'
    default:
      return env.toUpperCase()
  }
}

const getPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'critical':
      return 'destructive'
    case 'high':
      return 'warning'
    case 'medium':
      return 'default'
    case 'low':
      return 'secondary'
    default:
      return 'secondary'
  }
}

const getDataClassificationVariant = (classification: string) => {
  switch (classification) {
    case 'pii':
      return 'destructive'
    case 'confidential':
      return 'warning'
    case 'internal':
      return 'default'
    case 'public':
      return 'secondary'
    default:
      return 'secondary'
  }
}

const getDataClassificationLabel = (classification: string) => {
  switch (classification) {
    case 'pii':
      return 'PII/Sensitive'
    case 'confidential':
      return 'Confidential'
    case 'internal':
      return 'Internal'
    case 'public':
      return 'Public'
    default:
      return classification
  }
}

const getHealthVariant = (health: string) => {
  switch (health) {
    case 'excellent':
      return 'success'
    case 'good':
      return 'default'
    case 'fair':
      return 'warning'
    case 'poor':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const getHealthLabel = (health: string) => {
  switch (health) {
    case 'excellent':
      return 'Excellent'
    case 'good':
      return 'Good'
    case 'fair':
      return 'Fair'
    case 'poor':
      return 'Poor'
    default:
      return 'Unknown'
  }
}

const getHealthIcon = (health: string) => {
  switch (health) {
    case 'excellent':
      return '●'
    case 'good':
      return '●'
    case 'fair':
      return '●'
    case 'poor':
      return '●'
    default:
      return '○'
  }
}

// SLA Helper Functions
const getSLATargetHours = (priority: string): number => {
  switch (priority) {
    case 'critical':
      return 2 // 2 hours for critical
    case 'high':
      return 4 // 4 hours for high
    case 'medium':
      return 8 // 8 hours for medium
    case 'low':
      return 24 // 24 hours for low
    default:
      return 8
  }
}

const calculateSLAStatus = (
  lastExecution: any,
  priority: string
): { status: 'meeting' | 'at-risk' | 'breached' | 'unknown'; message: string } => {
  if (!lastExecution || !lastExecution.startTime) {
    return { status: 'unknown', message: 'No execution data' }
  }

  const targetHours = getSLATargetHours(priority)
  const targetMs = targetHours * 60 * 60 * 1000

  // If still running, check how long it's been running
  if (lastExecution.status === 'running') {
    const runningTime = Date.now() - new Date(lastExecution.startTime).getTime()
    const percentageUsed = (runningTime / targetMs) * 100

    if (percentageUsed >= 100) {
      return { status: 'breached', message: `Exceeded ${targetHours}h SLA` }
    } else if (percentageUsed >= 75) {
      return { status: 'at-risk', message: `At ${percentageUsed.toFixed(0)}% of ${targetHours}h SLA` }
    } else {
      return { status: 'meeting', message: `Within ${targetHours}h SLA` }
    }
  }

  // For completed/failed executions, check if it completed within SLA
  if (lastExecution.duration) {
    const percentageUsed = (lastExecution.duration / targetMs) * 100

    if (percentageUsed >= 100) {
      return { status: 'breached', message: `Exceeded ${targetHours}h SLA` }
    } else if (percentageUsed >= 90) {
      return { status: 'at-risk', message: `Used ${percentageUsed.toFixed(0)}% of ${targetHours}h SLA` }
    } else {
      return { status: 'meeting', message: `Met ${targetHours}h SLA` }
    }
  }

  return { status: 'unknown', message: 'Insufficient data' }
}

const getSLAVariant = (status: string) => {
  switch (status) {
    case 'meeting':
      return 'success'
    case 'at-risk':
      return 'warning'
    case 'breached':
      return 'destructive'
    default:
      return 'secondary'
  }
}

const formatDate = (date?: Date) => {
  if (!date) return 'Never'
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
    Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    'day'
  )
}

const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs <= 0) {
    return '—'
  }

  const totalSeconds = Math.floor(durationMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (seconds || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

const formatRows = (value?: number) => {
  if (typeof value !== 'number' || value < 0) {
    return '—'
  }

  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

export default function WorkflowsPage() {
  const router = useRouter()
  const { state, dispatch } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, deleteWorkflow, isLoading, error } = useWorkflowActions()
  const { toast } = useToast()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [workflowToDelete, setWorkflowToDelete] = React.useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [workflowTriggers, setWorkflowTriggers] = React.useState<Record<string, WorkflowTrigger[]>>({})
  const [loadingTriggers, setLoadingTriggers] = React.useState(false)
  const [currentPage, setCurrentPage] = React.useState(1)
  const workflowsPerPage = 20
  const [workflowMetrics, setWorkflowMetrics] = React.useState<Record<string, { successRate: number; totalRuns: number; health: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' }>>({})

  // Filter panel state
  const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
  const [environmentFilters, setEnvironmentFilters] = React.useState<string[]>([])
  const [priorityFilters, setPriorityFilters] = React.useState<string[]>([])
  const [dataClassificationFilters, setDataClassificationFilters] = React.useState<string[]>([])

  React.useEffect(() => {
    // Load triggers and metrics for all workflows
    const loadAllData = async () => {
      try {
        setLoadingTriggers(true)
        const triggersByWorkflow: Record<string, WorkflowTrigger[]> = {}
        const metricsByWorkflow: Record<string, { successRate: number; totalRuns: number; health: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' }> = {}

        await Promise.all(
          state.workflows.map(async (workflow) => {
            try {
              // Load triggers
              const triggers = await TriggersService.getTriggers(workflow.id)
              triggersByWorkflow[workflow.id] = triggers

              // Load execution history to calculate metrics
              const response = await fetch(`/api/workflows/${workflow.id}/executions`)
              if (response.ok) {
                const data = await response.json()
                const executions = data.executions || []

                // Calculate success rate from last 10 executions
                const recentExecutions = executions.slice(0, 10)
                const completedCount = recentExecutions.filter((e: any) => e.status === 'completed').length
                const totalCount = recentExecutions.length
                const successRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

                // Determine health status
                let health: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown' = 'unknown'
                if (totalCount === 0) {
                  health = 'unknown'
                } else if (successRate >= 95) {
                  health = 'excellent'
                } else if (successRate >= 80) {
                  health = 'good'
                } else if (successRate >= 60) {
                  health = 'fair'
                } else {
                  health = 'poor'
                }

                metricsByWorkflow[workflow.id] = {
                  successRate,
                  totalRuns: executions.length,
                  health
                }
              } else {
                metricsByWorkflow[workflow.id] = {
                  successRate: 0,
                  totalRuns: 0,
                  health: 'unknown'
                }
              }
            } catch (error) {
              console.error(`Failed to load data for workflow ${workflow.id}:`, error)
              triggersByWorkflow[workflow.id] = []
              metricsByWorkflow[workflow.id] = {
                successRate: 0,
                totalRuns: 0,
                health: 'unknown'
              }
            }
          })
        )

        setWorkflowTriggers(triggersByWorkflow)
        setWorkflowMetrics(metricsByWorkflow)
      } catch (error) {
        console.error('Failed to load workflow data:', error)
      } finally {
        setLoadingTriggers(false)
      }
    }

    if (state.workflows.length > 0) {
      loadAllData()
    }
  }, [state.workflows])

  // Filter workflows based on search, status, and advanced filters
  const filteredWorkflows = state.workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.application.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter

    // Advanced filters
    const matchesEnvironment = environmentFilters.length === 0 ||
      (workflow.environment && environmentFilters.includes(workflow.environment))
    const matchesPriority = priorityFilters.length === 0 ||
      (workflow.priority && priorityFilters.includes(workflow.priority))
    const matchesDataClassification = dataClassificationFilters.length === 0 ||
      (workflow.dataClassification && dataClassificationFilters.includes(workflow.dataClassification))

    return matchesSearch && matchesStatus && matchesEnvironment && matchesPriority && matchesDataClassification
  })

  // Calculate active filter count
  const activeFilterCount = environmentFilters.length + priorityFilters.length + dataClassificationFilters.length

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, environmentFilters, priorityFilters, dataClassificationFilters])

  // Calculate pagination
  const totalWorkflows = filteredWorkflows.length
  const totalPages = Math.ceil(totalWorkflows / workflowsPerPage)
  const startIndex = (currentPage - 1) * workflowsPerPage
  const endIndex = startIndex + workflowsPerPage
  const paginatedWorkflows = filteredWorkflows.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const formatNextRun = (timestamp?: number): string => {
    if (!timestamp) return 'Not scheduled'

    const nextRun = new Date(timestamp * 1000)
    const now = new Date()

    if (nextRun < now) {
      return 'Overdue'
    }

    return formatDistanceToNow(nextRun, { addSuffix: true })
  }

  // Filter panel handlers
  const toggleFilterValue = (filterType: 'environment' | 'priority' | 'dataClassification', value: string) => {
    const setters = {
      environment: setEnvironmentFilters,
      priority: setPriorityFilters,
      dataClassification: setDataClassificationFilters
    }
    const currentFilters = {
      environment: environmentFilters,
      priority: priorityFilters,
      dataClassification: dataClassificationFilters
    }

    const currentValues = currentFilters[filterType]
    const setter = setters[filterType]

    if (currentValues.includes(value)) {
      setter(currentValues.filter(v => v !== value))
    } else {
      setter([...currentValues, value])
    }
  }

  const clearAllFilters = () => {
    setEnvironmentFilters([])
    setPriorityFilters([])
    setDataClassificationFilters([])
  }

  const removeFilter = (filterType: 'environment' | 'priority' | 'dataClassification', value: string) => {
    toggleFilterValue(filterType, value)
  }

  const handleWorkflowAction = async (workflowId: string, action: 'run' | 'pause' | 'resume' | 'view' | 'delete') => {
    switch (action) {
      case 'run':
        await runWorkflow(workflowId)
        break
      case 'pause':
        await pauseWorkflow(workflowId)
        break
      case 'resume':
        await resumeWorkflow(workflowId)
        break
      case 'view':
        router.push(`/workflows/${workflowId}`)
        break
      case 'delete':
        const workflow = state.workflows.find(w => w.id === workflowId)
        if (workflow) {
          setWorkflowToDelete({ id: workflow.id, name: workflow.name })
          setDeleteModalOpen(true)
        }
        break
    }
  }

  const handleConfirmDelete = async () => {
    if (!workflowToDelete) return

    setIsDeleting(true)
    try {
      await deleteWorkflow(workflowToDelete.id)
      toast({
        type: 'success',
        title: 'Workflow Deleted',
        description: `"${workflowToDelete.name}" has been permanently deleted along with all associated jobs and execution history.`
      })
      setDeleteModalOpen(false)
      setWorkflowToDelete(null)
    } catch (error) {
      toast({
        type: 'error',
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete workflow'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCloneWorkflow = async (workflowId: string, workflowName: string) => {
    toast({
      type: 'info',
      title: 'Cloning Workflow',
      description: `Creating a copy of "${workflowName}"...`
    })
    // TODO: Implement clone functionality
  }

  const handleExportWorkflow = async (workflowId: string, workflowName: string) => {
    toast({
      type: 'info',
      title: 'Exporting Workflow',
      description: `Preparing export for "${workflowName}"...`
    })
    // TODO: Implement export functionality
  }

  const handleViewLineage = (workflowId: string) => {
    router.push(`/data-assets/lineage?workflowId=${workflowId}`)
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Error notification */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="border-l-4 border-primary pl-6">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">Workflows</h1>
          <p className="text-foreground-secondary mt-2 text-base md:text-lg">
            Manage and monitor your data workflows
          </p>
        </div>
        <Button 
          className="shadow-corporate-lg self-start md:self-auto"
          onClick={() => setCreateModalOpen(true)}
        >
          <span className="mr-2">+</span>
          Create New Workflow
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-foreground-muted" />
          <Input
            placeholder="Search workflows..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 pr-10 border border-border rounded-md bg-background-secondary text-sm h-10 appearance-none bg-no-repeat bg-right"
            style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpolyline points=%276 9 12 15 18 9%27%3E%3C/polyline%3E%3C/svg%3E')", backgroundPosition: "right 0.5rem center", backgroundSize: "1.25rem" }}
          >
            <option value="all">All Status</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-10 relative"
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Filter Side Panel */}
      {filterPanelOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-40 transition-opacity"
            onClick={() => setFilterPanelOpen(false)}
          />

          {/* Side Panel */}
          <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border shadow-2xl z-50 overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Filters</h2>
                {activeFilterCount > 0 && (
                  <p className="text-sm text-foreground-muted mt-1">
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setFilterPanelOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Filter Content */}
            <div className="px-6 py-4 space-y-6">
              {/* Environment Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Environment</h3>
                <div className="space-y-2">
                  {['development', 'qa', 'uat', 'production'].map((env) => (
                    <label key={env} className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={environmentFilters.includes(env)}
                        onChange={() => toggleFilterValue('environment', env)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors capitalize">
                        {getEnvironmentLabel(env)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Priority Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Priority</h3>
                <div className="space-y-2">
                  {['critical', 'high', 'medium', 'low'].map((priority) => (
                    <label key={priority} className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={priorityFilters.includes(priority)}
                        onChange={() => toggleFilterValue('priority', priority)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors capitalize">
                        {priority}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Data Classification Filter */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Data Classification</h3>
                <div className="space-y-2">
                  {['pii', 'confidential', 'internal', 'public'].map((classification) => (
                    <label key={classification} className="flex items-center space-x-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={dataClassificationFilters.includes(classification)}
                        onChange={() => toggleFilterValue('dataClassification', classification)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                        {getDataClassificationLabel(classification)}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Panel Footer */}
            <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 flex items-center justify-between gap-3">
              <Button
                variant="outline"
                onClick={clearAllFilters}
                className="flex-1"
                disabled={activeFilterCount === 0}
              >
                Clear All
              </Button>
              <Button
                onClick={() => setFilterPanelOpen(false)}
                className="flex-1"
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-foreground-muted">Active filters:</span>
          {environmentFilters.map((env) => (
            <Badge key={`env-${env}`} variant="secondary" className="gap-1">
              {getEnvironmentLabel(env)}
              <button
                onClick={() => removeFilter('environment', env)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {priorityFilters.map((priority) => (
            <Badge key={`priority-${priority}`} variant="secondary" className="gap-1 capitalize">
              Priority: {priority}
              <button
                onClick={() => removeFilter('priority', priority)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          {dataClassificationFilters.map((classification) => (
            <Badge key={`classification-${classification}`} variant="secondary" className="gap-1">
              {getDataClassificationLabel(classification)}
              <button
                onClick={() => removeFilter('dataClassification', classification)}
                className="ml-1 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="h-7 text-xs"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* Results Summary */}
      {filteredWorkflows.length > 0 && (
        <div className="flex items-center justify-between text-sm text-foreground-muted">
          <p>
            Showing {startIndex + 1} to {Math.min(endIndex, totalWorkflows)} of {totalWorkflows} workflow{totalWorkflows !== 1 ? 's' : ''}
          </p>
          {totalPages > 1 && (
            <p>
              Page {currentPage} of {totalPages}
            </p>
          )}
        </div>
      )}

      {/* Workflows List */}
      <div className="grid gap-4">
        {paginatedWorkflows.length === 0 ? (
          <Card className="p-8 text-center">
            <div className="text-foreground-muted">
              {state.workflows.length === 0 ? (
                <>
                  <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
                  <p className="text-sm mb-4">Create your first workflow to get started</p>
                  <Button onClick={() => setCreateModalOpen(true)}>
                    Create New Workflow
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium mb-2">No workflows found</h3>
                  <p className="text-sm">Try adjusting your search or filter criteria</p>
                </>
              )}
            </div>
          </Card>
        ) : (
          paginatedWorkflows.map((workflow) => {
            const completedJobs = workflow.jobs.filter(job => job.status === 'completed').length
            const failedJobs = workflow.jobs.filter(job => job.status === 'failed').length
            const runningJobs = workflow.jobs.filter(job => job.status === 'running').length
            const totalJobs = workflow.jobs.length
            const jobSummaryParts: string[] = []
            if (completedJobs) {
              jobSummaryParts.push(`${completedJobs} completed`)
            }
            if (runningJobs) {
              jobSummaryParts.push(`${runningJobs} running`)
            }
            if (failedJobs) {
              jobSummaryParts.push(`${failedJobs} failed`)
            }
            const jobSummary = totalJobs === 0
              ? 'No jobs configured yet'
              : jobSummaryParts.length > 0
                ? jobSummaryParts.join(' | ')
                : 'Jobs ready | awaiting next run'

            return (
              <Card key={workflow.id} className="group hover:shadow-corporate-xl hover:border-primary-200 transition-all duration-300">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4 mb-3">
                        <CardTitle className="text-lg text-foreground group-hover:text-primary-700 transition-colors">
                          {workflow.name}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Badge variant={getStatusVariant(workflow.status)}>
                            {workflow.status}
                          </Badge>
                          {workflow.status === 'running' && (
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          )}
                        </div>
                      </div>

                      {workflow.description && (
                        <p className="text-sm text-foreground-muted mb-3 line-clamp-1">
                          {workflow.description}
                        </p>
                      )}

                      {/* Enterprise Metadata Badges */}
                      <div className="flex items-center gap-2 flex-wrap mt-2">
                        {workflow.environment && (
                          <Badge variant={getEnvironmentVariant(workflow.environment)} className="text-xs font-medium">
                            {getEnvironmentLabel(workflow.environment)}
                          </Badge>
                        )}
                        {workflow.priority && (
                          <Badge variant={getPriorityVariant(workflow.priority)} className="text-xs font-medium">
                            Priority: {workflow.priority.charAt(0).toUpperCase() + workflow.priority.slice(1)}
                          </Badge>
                        )}
                        {/* SLA Status Indicator */}
                        {workflow.priority && workflow.lastExecution && (() => {
                          const slaStatus = calculateSLAStatus(workflow.lastExecution, workflow.priority)
                          return slaStatus.status !== 'unknown' && (
                            <Badge variant={getSLAVariant(slaStatus.status)} className="text-xs font-medium">
                              SLA: {slaStatus.message}
                            </Badge>
                          )
                        })()}
                        {workflow.dataClassification && (
                          <Badge variant={getDataClassificationVariant(workflow.dataClassification)} className="text-xs font-medium">
                            Data Classification: {getDataClassificationLabel(workflow.dataClassification)}
                          </Badge>
                        )}
                        {workflow.tags && workflow.tags.length > 0 && (
                          <>
                            {workflow.tags.slice(0, 3).map((tag: string) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {workflow.tags.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{workflow.tags.length - 3} more
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Actions Menu */}
                      <DropdownMenu
                        trigger={
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        }
                      >
                        <DropdownMenuItem onClick={() => handleWorkflowAction(workflow.id, 'view')}>
                          <Eye className="w-4 h-4" />
                          View Workflow
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(workflow.status === 'manual' || workflow.status === 'completed' || workflow.status === 'failed') && (
                          <DropdownMenuItem
                            onClick={() => !isLoading(workflow.id, 'run') && handleWorkflowAction(workflow.id, 'run')}
                          >
                            {isLoading(workflow.id, 'run') ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            Run Now
                          </DropdownMenuItem>
                        )}
                        {workflow.status === 'scheduled' && (
                          <DropdownMenuItem
                            onClick={() => !isLoading(workflow.id, 'pause') && handleWorkflowAction(workflow.id, 'pause')}
                          >
                            {isLoading(workflow.id, 'pause') ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                            Pause Schedule
                          </DropdownMenuItem>
                        )}
                        {workflow.status === 'paused' && (
                          <DropdownMenuItem
                            onClick={() => !isLoading(workflow.id, 'resume') && handleWorkflowAction(workflow.id, 'resume')}
                          >
                            {isLoading(workflow.id, 'resume') ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                            Resume Schedule
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          destructive
                          onClick={() => handleWorkflowAction(workflow.id, 'delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete Workflow
                        </DropdownMenuItem>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {/* Health Metrics Bar */}
                  {workflowMetrics[workflow.id] && workflowMetrics[workflow.id].health !== 'unknown' && (
                    <div className="mb-4 p-3 rounded-lg bg-background-secondary/40 border border-border">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase text-foreground-muted">Health</span>
                            <Badge variant={getHealthVariant(workflowMetrics[workflow.id].health)} className="text-xs">
                              {getHealthIcon(workflowMetrics[workflow.id].health)} {getHealthLabel(workflowMetrics[workflow.id].health)}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase text-foreground-muted">Success Rate</span>
                            <span className="text-sm font-semibold text-foreground">
                              {workflowMetrics[workflow.id].successRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium uppercase text-foreground-muted">Total Runs</span>
                            <span className="text-sm font-semibold text-foreground">
                              {workflowMetrics[workflow.id].totalRuns}
                            </span>
                          </div>
                        </div>
                        {/* Visual Progress Bar */}
                        <div className="flex-1 max-w-xs">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                workflowMetrics[workflow.id].successRate >= 95 ? 'bg-green-500' :
                                workflowMetrics[workflow.id].successRate >= 80 ? 'bg-blue-500' :
                                workflowMetrics[workflow.id].successRate >= 60 ? 'bg-yellow-500' :
                                'bg-red-500'
                              }`}
                              style={{ width: `${workflowMetrics[workflow.id].successRate}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6 text-sm border-t border-border pt-4">
                    <div>
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Application</span>
                      <p className="font-semibold text-foreground mt-1">{workflow.application}</p>
                    </div>
                    <div>
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Owner</span>
                      <p className="font-semibold text-foreground mt-1">{workflow.owner}</p>
                    </div>
                    <div>
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Jobs</span>
                      <p className="font-semibold text-foreground mt-1">{workflow.jobs.length} job{workflow.jobs.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div>
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Triggers</span>
                      <div className="flex items-center gap-2 mt-1">
                        {loadingTriggers ? (
                          <Loader2 className="w-3 h-3 animate-spin text-foreground-muted" />
                        ) : (
                          <>
                            <Zap className="w-4 h-4 text-primary" />
                            <p className="font-semibold text-foreground">
                              {workflowTriggers[workflow.id]?.length || 0}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Next Run</span>
                      <div className="flex items-center gap-2 mt-1">
                        {workflow.nextRun ? (
                          <>
                            <Calendar className="w-4 h-4 text-green-600" />
                            <p className="font-semibold text-foreground text-xs">
                              {formatDistanceToNow(workflow.nextRun, { addSuffix: true })}
                            </p>
                          </>
                        ) : workflow.status === 'dependency' ? (
                          <p className="text-xs text-foreground-muted">On dependency</p>
                        ) : (
                          <p className="text-xs text-foreground-muted">Manual only</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Last Execution Summary */}
                  {workflow.lastExecution && (
                    <details className="mt-4 rounded-lg border border-border bg-background-secondary/60 overflow-hidden">
                      <summary className="p-4 cursor-pointer list-none hover:bg-background-secondary transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="text-xs font-medium uppercase text-foreground-muted">
                              Last Execution
                            </span>
                            <Badge variant={getStatusVariant(workflow.lastExecution.status)}>
                              {workflow.lastExecution.status}
                            </Badge>
                          </div>
                          <div className="text-xs text-foreground-muted">
                            {workflow.lastExecution.endTime
                              ? formatDistanceToNow(workflow.lastExecution.endTime, { addSuffix: true })
                              : workflow.lastExecution.startTime
                              ? `Started ${formatDistanceToNow(workflow.lastExecution.startTime, { addSuffix: true })}`
                              : 'In progress'}
                          </div>
                        </div>
                      </summary>
                      <div className="px-4 pb-4 pt-2 border-t border-border space-y-2">
                        <div className="grid grid-cols-3 gap-4 text-xs">
                          <div>
                            <span className="text-foreground-muted">Status</span>
                            <p className="font-semibold text-foreground mt-1">{workflow.lastExecution.status}</p>
                          </div>
                          <div>
                            <span className="text-foreground-muted">Duration</span>
                            <p className="font-semibold text-foreground mt-1">
                              {formatDuration(workflow.lastExecution.duration)}
                            </p>
                          </div>
                          <div>
                            <span className="text-foreground-muted">Jobs</span>
                            <p className="font-semibold text-foreground mt-1">
                              {workflow.lastExecution.completedJobs}/{workflow.lastExecution.totalJobs} completed
                              {workflow.lastExecution.failedJobs > 0 && ` • ${workflow.lastExecution.failedJobs} failed`}
                            </p>
                          </div>
                        </div>
                        {workflow.lastExecution.endTime && (
                          <div className="text-xs text-foreground-muted pt-2">
                            Finished: {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            }).format(workflow.lastExecution.endTime)}
                          </div>
                        )}
                      </div>
                    </details>
                  )}

                  {/* No execution history */}
                  {!workflow.lastExecution && (
                    <div className="mt-4 rounded-lg border border-border bg-background-secondary/60 p-4">
                      <div className="flex items-center gap-2 text-xs font-medium text-foreground-muted">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="uppercase">Last Execution</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground-muted">
                        Awaiting first run • {workflow.jobs.length} job{workflow.jobs.length !== 1 ? 's' : ''} configured
                      </p>
                    </div>
                  )}

                  {/* Quick Actions Bar */}
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase text-foreground-muted">Quick Actions</span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleCloneWorkflow(workflow.id, workflow.name)}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Clone
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleExportWorkflow(workflow.id, workflow.name)}
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Export
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => handleViewLineage(workflow.id)}
                        >
                          <GitBranch className="w-3 h-3 mr-1" />
                          Lineage
                        </Button>
                      </div>
                    </div>
                  </div>
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 border-t border-border pt-6">
          <div className="text-sm text-foreground-muted">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="h-9"
            >
              First
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="h-9"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => goToPage(pageNum)}
                    className="h-9 w-9 p-0"
                  >
                    {pageNum}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="h-9"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="h-9"
            >
              Last
            </Button>
          </div>
        </div>
      )}

      {/* Create Workflow Modal */}
      <CreateWorkflowModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
      />

      {/* Delete Confirmation Modal */}
      {workflowToDelete && (
        <DeleteConfirmationModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onConfirm={handleConfirmDelete}
          title="Delete Workflow"
          description="Are you sure you want to delete this workflow? This action cannot be undone and will permanently delete all associated jobs and execution history."
          itemName={workflowToDelete.name}
          itemType="workflow"
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}

