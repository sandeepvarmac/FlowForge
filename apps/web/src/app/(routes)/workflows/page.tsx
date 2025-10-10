"use client"

import * as React from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input, useToast, DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui'
import { CreateWorkflowModal } from '@/components/workflows/create-workflow-modal'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { Search, Filter, MoreVertical, Play, Pause, Settings, Loader2, Eye, Trash2, Clock } from 'lucide-react'
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
    case 'paused':
      return 'warning'
    case 'failed':
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
  const { state } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, deleteWorkflow, isLoading, error } = useWorkflowActions()
  const { toast } = useToast()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [workflowToDelete, setWorkflowToDelete] = React.useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  // Filter workflows based on search and status
  const filteredWorkflows = state.workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.application.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleWorkflowAction = async (workflowId: string, action: 'run' | 'pause' | 'resume' | 'edit' | 'view' | 'delete') => {
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
      case 'edit':
        console.log(`Edit workflow ${workflowId}`)
        // TODO: Implement edit workflow
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
          <Button variant="outline" size="sm" className="h-10">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
        </div>
      </div>

      {/* Workflows List */}
      <div className="grid gap-4">
        {filteredWorkflows.length === 0 ? (
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
          filteredWorkflows.map((workflow) => {
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
                    <div className="flex items-center space-x-4">
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
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleWorkflowAction(workflow.id, 'edit')}>
                          <Settings className="w-4 h-4" />
                          Edit Workflow
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {(workflow.status === 'manual' || workflow.status === 'completed' || workflow.status === 'failed') && (
                          <DropdownMenuItem
                            onClick={() => handleWorkflowAction(workflow.id, 'run')}
                            disabled={isLoading(workflow.id, 'run')}
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
                            onClick={() => handleWorkflowAction(workflow.id, 'pause')}
                            disabled={isLoading(workflow.id, 'pause')}
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
                            onClick={() => handleWorkflowAction(workflow.id, 'resume')}
                            disabled={isLoading(workflow.id, 'resume')}
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
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6 text-sm border-t border-border pt-4">
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
                      <span className="text-foreground-muted text-xs uppercase tracking-wide font-medium">Created</span>
                      <p className="font-semibold text-foreground mt-1">
                        {new Intl.DateTimeFormat('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          year: 'numeric'
                        }).format(workflow.createdAt)}
                      </p>
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
              </CardContent>
            </Card>
            )
          })
        )}
      </div>

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

