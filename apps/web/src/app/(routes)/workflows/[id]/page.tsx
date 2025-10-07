"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, useToast } from '@/components/ui'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions, useJobActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { CreateJobModal, JobExecutionModal } from '@/components/jobs'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { MetadataCatalog } from '@/components/metadata'
import { useUploadQueue } from '@/contexts/upload-queue-context'
import { formatDistanceToNow } from 'date-fns'
import type { Job } from '@/types/workflow'
import { ArrowLeft, Play, Pause, Settings, Activity, Clock, User, Building, CheckCircle, XCircle, Loader2, AlertCircle, Database, FileText, Cloud, ArrowRight, Layers, Trash2 } from 'lucide-react'

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'scheduled': return 'default'
    case 'running': return 'default'
    case 'manual': return 'secondary'
    case 'paused': return 'warning'
    case 'failed': return 'destructive'
    default: return 'secondary'
  }
}

type ExecutionStatus = 'completed' | 'failed' | 'running'


interface JobExecutionDetail {
  id: string
  jobId: string
  jobName: string
  jobType?: string
  status: string
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  recordsProcessed?: number
  landingKey?: string
  bronzeFilePath?: string
  silverFilePath?: string
  goldFilePath?: string
  logs: string[]
  error?: string
  flowRunId?: string
}

interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  duration?: number
  logs: string[]
  error?: string
  jobExecutions?: JobExecutionDetail[]
  completedJobs?: number
  failedJobs?: number
  totalRecords?: number
}

const formatDateTime = (date?: Date) => {
  if (!date) {
    return 'N/A'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date)
}

const formatDurationMs = (ms?: number) => {
  if (!ms || ms <= 0) {
    return 'N/A'
  }

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []
  if (hours) {
    parts.push(`${hours}h`)
  }
  if (minutes) {
    parts.push(`${minutes}m`)
  }
  if (seconds || parts.length === 0) {
    parts.push(`${seconds}s`)
  }

  return parts.join(' ')
}

export default function WorkflowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { state } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, isLoading } = useWorkflowActions()
  const { createJob, deleteJob } = useJobActions()
  const { toast } = useToast()
  const { queueUpload } = useUploadQueue()
  const [executions, setExecutions] = React.useState<WorkflowExecution[]>([])
  const [loadingExecutions, setLoadingExecutions] = React.useState(false)
  const [createJobModalOpen, setCreateJobModalOpen] = React.useState(false)
  const [runningJobs, setRunningJobs] = React.useState<Set<string>>(new Set())
  const [executionModalOpen, setExecutionModalOpen] = React.useState(false)
  const [selectedExecution, setSelectedExecution] = React.useState<{ jobId: string; jobName: string; executionId: string } | null>(null)
  const [metadataCatalogOpen, setMetadataCatalogOpen] = React.useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [jobToDelete, setJobToDelete] = React.useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const workflowId = params.id as string
  const workflow = state.workflows.find(w => w.id === workflowId)

  const jobLookup = React.useMemo(() => {
    if (!workflow) {
      return {} as Record<string, Job>
    }

    return workflow.jobs.reduce<Record<string, Job>>((acc, job) => {
      acc[job.id] = job
      return acc
    }, {})
  }, [workflow])


  React.useEffect(() => {
    if (workflow) {
      loadExecutions()
    }
  }, [workflow])

  // Auto-refresh polling for running executions
  React.useEffect(() => {
    // Check if any execution or job is running
    const hasRunningExecutions = executions.some(exec =>
      exec.status === 'running' ||
      exec.jobExecutions?.some(job => job.status === 'running')
    )

    if (!hasRunningExecutions) {
      return // No polling needed
    }

    // Poll every 3 seconds
    const interval = setInterval(() => {
      loadExecutions()
    }, 3000)

    return () => clearInterval(interval)
  }, [executions])

  const loadExecutions = async () => {
    try {
      setLoadingExecutions(true)
      const executionData = await WorkflowService.getWorkflowExecutions(workflowId)
      setExecutions(executionData)
    } catch (error) {
      console.error('Failed to load executions:', error)
    } finally {
      setLoadingExecutions(false)
    }
  }

  if (!workflow) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Workflow not found</h2>
          <p className="text-foreground-muted">The workflow you're looking for doesn't exist.</p>
        </Card>
      </div>
    )
  }

  const handleAction = async (action: 'run' | 'pause' | 'resume') => {
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
    }
  }

  const handleRunJob = async (jobId: string) => {
    if (runningJobs.has(jobId)) return

    setRunningJobs(prev => new Set([...prev, jobId]))

    try {
      console.log(`Executing job: ${jobId}`)

      // Call the backend API to execute the job
      const response = await fetch(`/api/jobs/${jobId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Job execution failed')
      }

      const result = await response.json()
      console.log('Job execution result:', result)

      // Show execution results
      const job = workflow?.jobs.find(j => j.id === jobId)
      if (job && result.execution) {
        setSelectedExecution({
          jobId,
          jobName: job.name,
          executionId: result.execution.id
        })
        setExecutionModalOpen(true)
      }

      // Reload executions to show updated data
      await loadExecutions()

    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)
      alert(error instanceof Error ? error.message : 'Job execution failed')
    } finally {
      setRunningJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
    }
  }

  const handleDeleteJob = (jobId: string, jobName: string) => {
    setJobToDelete({ id: jobId, name: jobName })
    setDeleteModalOpen(true)
  }

  const handleConfirmDeleteJob = async () => {
    if (!jobToDelete) return

    setIsDeleting(true)
    try {
      await deleteJob(workflowId, jobToDelete.id)
      toast({
        type: 'success',
        title: 'Job Deleted',
        description: `"${jobToDelete.name}" has been permanently deleted along with its execution history.`
      })
      setDeleteModalOpen(false)
      setJobToDelete(null)
    } catch (error) {
      toast({
        type: 'error',
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete job'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Workflows
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {(workflow.status === 'manual' || workflow.status === 'completed' || workflow.status === 'failed') && (
            <Button 
              onClick={() => handleAction('run')}
              disabled={isLoading(workflowId, 'run')}
            >
              <Play className="w-4 h-4 mr-2" />
              Run Workflow
            </Button>
          )}
          {workflow.status === 'scheduled' && (
            <Button 
              variant="outline"
              onClick={() => handleAction('pause')}
              disabled={isLoading(workflowId, 'pause')}
            >
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          {workflow.status === 'paused' && (
            <Button 
              onClick={() => handleAction('resume')}
              disabled={isLoading(workflowId, 'resume')}
            >
              <Play className="w-4 h-4 mr-2" />
              Resume
            </Button>
          )}
          <Button variant="outline" onClick={() => setMetadataCatalogOpen(true)}>
            <Database className="w-4 h-4 mr-2" />
            Metadata Catalog
          </Button>
          <Button variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Workflow Info */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-3">
                  {workflow.name}
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(workflow.status)}>
                      {workflow.status}
                    </Badge>
                    {workflow.status === 'running' && (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </div>
                </CardTitle>
                <p className="text-foreground-muted mt-2">{workflow.description}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Building className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Application</p>
                  <p className="font-semibold">{workflow.application}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary-50 rounded-lg flex items-center justify-center">
                  <User className="w-5 h-5 text-secondary" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Owner</p>
                  <p className="font-semibold">{workflow.owner}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                  <Activity className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Type</p>
                  <p className="font-semibold capitalize">{workflow.type}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-foreground-muted">Created</p>
                  <p className="font-semibold">
                    {new Intl.DateTimeFormat('en-US', { 
                      month: 'short', 
                      day: 'numeric',
                      year: 'numeric'
                    }).format(workflow.createdAt)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Job Pipeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Job Pipeline ({workflow.jobs.length} jobs)
            </CardTitle>
            <Button 
              variant="outline"
              onClick={() => setCreateJobModalOpen(true)}
            >
              <span className="mr-2">+</span>
              Add Job
            </Button>
          </CardHeader>
          <CardContent>
            {workflow.jobs.length === 0 ? (
              <div className="text-center py-8 text-foreground-muted">
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No jobs configured</p>
                <p className="text-sm">Add jobs to define your data pipeline</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workflow.jobs
                  .sort((a, b) => a.order - b.order)
                  .map((job, index) => {
                    // Get job executions from the most recent execution
                    const latestExecution = executions.length > 0 ? executions[0] : null
                    const jobExecution = latestExecution?.jobExecutions?.find(je => je.jobId === job.id)

                    return (
                    <div key={job.id} className="relative">
                      {/* Job Card */}
                      <details className="border border-border rounded-lg hover:bg-background-secondary transition-colors group">
                        <summary className="p-4 cursor-pointer list-none">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center mt-1">
                                {job.type === 'file-based' && <FileText className="w-4 h-4 text-primary" />}
                                {job.type === 'database' && <Database className="w-4 h-4 text-primary" />}
                                {job.type === 'api' && <Cloud className="w-4 h-4 text-primary" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-semibold text-foreground">{job.name}</h4>
                                  <Badge variant={
                                    jobExecution?.status === 'completed' ? 'success' :
                                    jobExecution?.status === 'failed' ? 'destructive' :
                                    jobExecution?.status === 'running' ? 'default' :
                                    'secondary'
                                  }>
                                    {jobExecution?.status || 'not run'}
                                  </Badge>
                                  <span className="text-xs text-foreground-muted group-open:hidden">▶ Click to expand</span>
                                  <span className="text-xs text-foreground-muted hidden group-open:inline">▼ Click to collapse</span>
                                </div>
                                <p className="text-sm text-foreground-muted mb-2">{job.description}</p>

                                {/* Source Info */}
                                <div className="text-xs text-foreground-muted">
                                  <span className="font-medium">Source:</span> {job.sourceConfig.name} ({job.sourceConfig.type})
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                              <div className="text-right text-xs text-foreground-muted">
                                <div>Order: {job.order}</div>
                                {job.lastRun && (
                                  <div className="mt-1">
                                    Last run: {new Intl.DateTimeFormat('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    }).format(job.lastRun)}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRunJob(job.id)}
                                  disabled={runningJobs.has(job.id)}
                                  className="text-xs"
                                >
                                  {runningJobs.has(job.id) ? (
                                    <>
                                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                      Running
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 mr-1" />
                                      Run
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteJob(job.id, job.name)}
                                  className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete Job"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                          </div>

                          {/* Pipeline Layers */}
                          <div className="flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                              <span className="text-foreground-muted">Bronze</span>
                              {job.destinationConfig.bronzeConfig.enabled && (
                                <CheckCircle className="w-3 h-3 text-green-600" />
                              )}
                            </div>

                            {job.destinationConfig.silverConfig?.enabled && (
                              <>
                                <ArrowRight className="w-3 h-3 text-foreground-muted" />
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  <span className="text-foreground-muted">Silver</span>
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                </div>
                              </>
                            )}

                            {job.destinationConfig.goldConfig?.enabled && (
                              <>
                                <ArrowRight className="w-3 h-3 text-foreground-muted" />
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                  <span className="text-foreground-muted">Gold</span>
                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                </div>
                              </>
                            )}
                          </div>
                        </summary>

                        {/* Expanded Layer Details */}
                        <div className="px-4 pb-4 pt-2 border-t border-border">
                          {jobExecution ? (
                            <div className="space-y-4">
                              <div className="text-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <Layers className="w-4 h-4 text-primary" />
                                  <h5 className="font-semibold">Medallion Layer Progression</h5>
                                </div>

                                {/* Landing */}
                                <div className="ml-6 space-y-2">
                                  <div className="flex items-start gap-3 p-2 bg-blue-50 rounded-md">
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                                      L
                                    </div>
                                    <div className="flex-1">
                                      <div className="font-medium text-sm text-blue-900">Landing</div>
                                      <div className="text-xs text-blue-700 font-mono break-all">
                                        {jobExecution.landingKey || 'N/A'}
                                      </div>
                                    </div>
                                  </div>

                                  {/* Bronze */}
                                  {jobExecution.bronzeFilePath && (
                                    <>
                                      <div className="ml-3 text-foreground-muted">↓</div>
                                      <div className="flex items-start gap-3 p-2 bg-amber-50 rounded-md">
                                        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                                          B
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-sm text-amber-900">Bronze</div>
                                          <div className="text-xs text-amber-700 font-mono break-all">
                                            {jobExecution.bronzeFilePath}
                                          </div>
                                          {jobExecution.recordsProcessed > 0 && (
                                            <div className="text-xs text-amber-600 mt-1">
                                              {jobExecution.recordsProcessed} rows ingested
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Silver */}
                                  {jobExecution.silverFilePath && (
                                    <>
                                      <div className="ml-3 text-foreground-muted">↓</div>
                                      <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                                        <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                                          S
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-sm text-gray-900">Silver</div>
                                          <div className="text-xs text-gray-700 font-mono break-all">
                                            {jobExecution.silverFilePath}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}

                                  {/* Gold */}
                                  {jobExecution.goldFilePath && (
                                    <>
                                      <div className="ml-3 text-foreground-muted">↓</div>
                                      <div className="flex items-start gap-3 p-2 bg-yellow-50 rounded-md">
                                        <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold mt-0.5">
                                          G
                                        </div>
                                        <div className="flex-1">
                                          <div className="font-medium text-sm text-yellow-900">Gold</div>
                                          <div className="text-xs text-yellow-700 font-mono break-all">
                                            {jobExecution.goldFilePath}
                                          </div>
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Execution Metadata */}
                              <div className="text-xs text-foreground-muted space-y-1">
                                <div><span className="font-medium">Started:</span> {jobExecution.startedAt ? new Date(jobExecution.startedAt).toLocaleString() : 'N/A'}</div>
                                {jobExecution.completedAt && (
                                  <div><span className="font-medium">Completed:</span> {new Date(jobExecution.completedAt).toLocaleString()}</div>
                                )}
                                {jobExecution.durationMs && (
                                  <div><span className="font-medium">Duration:</span> {(jobExecution.durationMs / 1000).toFixed(2)}s</div>
                                )}
                                {jobExecution.flowRunId && (
                                  <div><span className="font-medium">Prefect Run ID:</span> <code className="text-xs">{jobExecution.flowRunId}</code></div>
                                )}
                              </div>

                              {/* Logs */}
                              {jobExecution.logs && jobExecution.logs.length > 0 && (
                                <div>
                                  <h6 className="text-xs font-semibold mb-1 text-foreground-muted">Execution Logs</h6>
                                  <div className="bg-background-secondary rounded-md p-2 max-h-40 overflow-y-auto">
                                    {jobExecution.logs.map((log: string, idx: number) => (
                                      <div key={idx} className="text-xs font-mono text-foreground-muted">
                                        {log}
                                      </div>
                                                      </div>
                                </div>
                              )}

                              {jobExecution.error && (
                                <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                                  <div className="flex items-center gap-2 text-red-700">
                                    <AlertCircle className="w-4 h-4" />
                                    <span className="text-xs font-medium">Error</span>
                                  </div>
                                  <p className="text-xs text-red-600 mt-1">{jobExecution.error}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-center text-sm text-foreground-muted py-4">
                              No execution data available. Run this job to see layer progression.
                            </div>
                          )}
                        </div>
                      </details>

                      {/* Connector Arrow (except for last job) */}
                      {index < workflow.jobs.length - 1 && (
                        <div className="flex justify-center my-2">
                          <div className="w-6 h-6 bg-primary-50 rounded-full flex items-center justify-center">
                            <ArrowRight className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  )
                  })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution History */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Executions</CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadExecutions}
              disabled={loadingExecutions}
            >
              {loadingExecutions ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Refresh"
              )}
            </Button>
          </CardHeader>
          <CardContent>
            {loadingExecutions ? (
              <div className="text-center py-8">
                <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-primary" />
                <p className="text-foreground-muted">Loading execution history...</p>
              </div>
            ) : executions.length === 0 ? (
              <div className="text-center py-8 text-foreground-muted">
                <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No execution history available</p>
                <p className="text-sm">Run this workflow to see execution details</p>
              </div>
            ) : (
              <div className="space-y-4">

              {executions.map((execution) => {
                const jobExecutions = Array.isArray(execution.jobExecutions) ? execution.jobExecutions : []
                const completedJobs = jobExecutions.filter(job => job.status === 'completed').length
                const failedJobs = jobExecutions.filter(job => job.status === 'failed').length
                const runningJobs = jobExecutions.filter(job => job.status === 'running').length
                const waitingJobs = Math.max(jobExecutions.length - completedJobs - failedJobs - runningJobs, 0)
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
                if (waitingJobs) {
                  jobSummaryParts.push(`${waitingJobs} pending`)
                }

                const jobSummaryText = jobExecutions.length === 0 ? 'No job runs recorded' : jobSummaryParts.join(' | ')

                return (
                  <div
                    key={execution.id}
                    className="border border-border rounded-lg p-4 hover:bg-background-secondary transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {execution.status === 'completed' && (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          )}
                          {execution.status === 'failed' && (
                            <XCircle className="w-5 h-5 text-red-600" />
                          )}
                          {execution.status === 'running' && (
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                          )}
                          <Badge
                            variant={
                              execution.status === 'completed'
                                ? 'success'
                                : execution.status === 'failed'
                                ? 'destructive'
                                : 'default'
                            }
                          >
                            {execution.status}
                          </Badge>
                        </div>
                        <span className="text-sm text-foreground-muted">
                          Execution #{execution.id}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {formatDateTime(execution.startTime)}
                        </p>
                        {execution.startTime && (
                          <p className="text-xs text-foreground-muted">
                            {formatDistanceToNow(execution.startTime, { addSuffix: true })}
                          </p>
                        )}
                        {execution.duration && (
                          <p className="text-xs text-foreground-muted">
                            Duration: {formatDurationMs(execution.duration)}
                          </p>
                        )}
                        {jobSummaryText && jobExecutions.length > 0 && (
                          <p className="text-xs text-foreground-muted mt-1">
                            {jobSummaryText}
                          </p>
                        )}
                      </div>
                    </div>

                    {execution.error && (
                      <div className="mb-3 border border-red-200 bg-red-50 p-3 rounded-md">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Error</span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">{execution.error}</p>
                      </div>
                    )}

                    {jobExecutions.length > 0 && (
                      <div className="mt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-primary" />
                          <h5 className="text-sm font-semibold text-foreground">Job Outcomes</h5>
                        </div>
                        <div className="space-y-3">
                          {jobExecutions.map((jobExecution) => {
                            const jobMeta = jobLookup[jobExecution.jobId]
                            const jobType = jobExecution.jobType ?? jobMeta?.type
                            const hasProcessedRows = typeof jobExecution.recordsProcessed === 'number' && jobExecution.recordsProcessed > 0

                            const layerSections = [
                              {
                                key: 'landing',
                                label: 'Landing',
                                char: 'L',
                                value: jobExecution.landingKey || 'Waiting for ingestion',
                                containerBg: 'bg-blue-50',
                                bubbleBg: 'bg-blue-500',
                                titleColor: 'text-blue-900',
                                valueColor: 'text-blue-700',
                                extra: undefined,
                                always: true
                              },
                              {
                                key: 'bronze',
                                label: 'Bronze',
                                char: 'B',
                                value: jobExecution.bronzeFilePath,
                                containerBg: 'bg-amber-50',
                                bubbleBg: 'bg-amber-500',
                                titleColor: 'text-amber-900',
                                valueColor: 'text-amber-700',
                                extra: hasProcessedRows ? `${jobExecution.recordsProcessed} rows ingested` : undefined,
                                always: false
                              },
                              {
                                key: 'silver',
                                label: 'Silver',
                                char: 'S',
                                value: jobExecution.silverFilePath,
                                containerBg: 'bg-gray-50',
                                bubbleBg: 'bg-gray-400',
                                titleColor: 'text-gray-900',
                                valueColor: 'text-gray-700',
                                extra: undefined,
                                always: false
                              },
                              {
                                key: 'gold',
                                label: 'Gold',
                                char: 'G',
                                value: jobExecution.goldFilePath,
                                containerBg: 'bg-yellow-50',
                                bubbleBg: 'bg-yellow-500',
                                titleColor: 'text-yellow-900',
                                valueColor: 'text-yellow-700',
                                extra: undefined,
                                always: false
                              }
                            ]

                            const visibleSections = layerSections.filter(section => section.always || section.value)

                            return (
                              <div key={jobExecution.id} className="rounded-lg border border-border bg-background-secondary/60 p-3">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center mt-1">
                                      {jobType === 'database' && <Database className="w-4 h-4 text-primary" />}
                                      {jobType === 'api' && <Cloud className="w-4 h-4 text-primary" />}
                                      {(!jobType || jobType === 'file-based' || (jobType !== 'database' && jobType !== 'api')) && (
                                        <FileText className="w-4 h-4 text-primary" />
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <h6 className="text-sm font-semibold text-foreground">{jobExecution.jobName}</h6>
                                        <Badge variant={getStatusVariant(jobExecution.status)}>
                                          {jobExecution.status}
                                        </Badge>
                                      </div>
                                      {jobMeta?.description && (
                                        <p className="mt-1 text-xs text-foreground-muted">{jobMeta.description}</p>
                                      )}
                                      {jobMeta?.sourceConfig && (
                                        <p className="text-xs text-foreground-muted mt-1">
                                          Source: {jobMeta.sourceConfig.name} ({jobMeta.sourceConfig.type})
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right text-xs text-foreground-muted space-y-1">
                                    {typeof jobMeta?.order === 'number' && (
                                      <div>Order: {jobMeta.order}</div>
                                    )}
                                    {jobExecution.durationMs && jobExecution.durationMs > 0 && (
                                      <div>Duration: {formatDurationMs(jobExecution.durationMs)}</div>
                                    )}
                                    {typeof jobExecution.recordsProcessed === 'number' && jobExecution.recordsProcessed >= 0 && (
                                      <div>{jobExecution.recordsProcessed} rows processed</div>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3 space-y-2">
                                  {visibleSections.map(section => (
                                    <div key={section.key} className={`flex items-start gap-3 rounded-md ${section.containerBg} p-2`}>
                                      <div className={`w-5 h-5 rounded-full ${section.bubbleBg} text-white text-[11px] font-bold flex items-center justify-center mt-0.5`}>
                                        {section.char}
                                      </div>
                                      <div className="flex-1">
                                        <div className={`text-xs font-semibold ${section.titleColor}`}>{section.label}</div>
                                        <div className={`text-xs font-mono break-all ${section.valueColor}`}>
                                          {section.value || 'Not available'}
                                        </div>
                                        {section.extra && (
                                          <div className="text-[11px] text-foreground-muted mt-1">{section.extra}</div>
                                        )}
                                      </div>
                                    </div>
                                                  </div>
                                <div className="mt-3 flex flex-wrap gap-3 text-xs text-foreground-muted">
                                  {jobExecution.startedAt && (
                                    <span>Started: {formatDateTime(jobExecution.startedAt)}</span>
                                  )}
                                  {jobExecution.completedAt && (
                                    <span>Completed: {formatDateTime(jobExecution.completedAt)}</span>
                                  )}
                                  {jobExecution.durationMs && jobExecution.durationMs > 0 && (
                                    <span>Elapsed: {formatDurationMs(jobExecution.durationMs)}</span>
                                  )}
                                  {jobExecution.flowRunId && (
                                    <span>
                                      Prefect Run ID: <code className="text-xs">{jobExecution.flowRunId}</code>
                                    </span>
                                  )}
                                </div>
                                {jobExecution.error && (
                                  <div className="mt-3 border border-red-200 bg-red-50 p-3 rounded-md">
                                    <div className="flex items-center gap-2 text-red-700">
                                      <AlertCircle className="w-4 h-4" />
                                      <span className="text-xs font-semibold">Job Error</span>
                                    </div>
                                    <p className="text-xs text-red-600 mt-1">{jobExecution.error}</p>
                                  </div>
                                )}
                                {jobExecution.logs && jobExecution.logs.length > 0 && (
                                  <div className="mt-3 rounded-md bg-background p-3 space-y-1">
                                    {jobExecution.logs.slice(0, 4).map((log, logIndex) => (
                                      <div key={logIndex} className="text-xs font-mono text-foreground-muted">
                                        <span className="mr-2 opacity-70">{String(logIndex + 1).padStart(2, '0')}.</span>
                                        {log}
                                      </div>
                                                        {jobExecution.logs.length > 4 && (
                                      <p className="text-[11px] text-foreground-muted/70">
                                        +{jobExecution.logs.length - 4} additional log entries
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground-muted">Execution Log</h4>
                      <div className="bg-background-secondary rounded-md p-3 space-y-1">
                        {(Array.isArray(execution.logs) ? execution.logs : []).length === 0 ? (
                          <p className="text-sm text-foreground-muted">No logs recorded yet.</p>
                        ) : (
                          (Array.isArray(execution.logs) ? execution.logs : []).map((log, index) => (
                            <div key={index} className="text-sm font-mono text-foreground-muted">
                              <span className="text-xs text-foreground-muted mr-2">
                                {String(index + 1).padStart(2, '0')}:
                              </span>
                              {log}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Configuration</CardTitle>
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4 mr-2" />
              Edit Configuration
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-3">Workflow Settings</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Execution Type</span>
                    <span className="font-medium capitalize">{workflow.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Current Status</span>
                    <Badge variant={getStatusVariant(workflow.status)}>
                      {workflow.status}
                    </Badge>
                  </div>
                  {workflow.nextRun && (
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Next Scheduled Run</span>
                      <span className="font-medium">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(workflow.nextRun)}
                      </span>
                    </div>
                  )}
                  {workflow.lastRun && (
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Last Run</span>
                      <span className="font-medium">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        }).format(workflow.lastRun)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-3">Notifications & Alerts</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Email Notifications</span>
                    <span className="font-medium">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Failure Alerts</span>
                    <span className="font-medium">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Success Notifications</span>
                    <span className="font-medium">Disabled</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-semibold mb-3">Workflow Description</h4>
              <p className="text-foreground-muted leading-relaxed">
                {workflow.description || 'No description provided for this workflow.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Job Modal */}
      <CreateJobModal
        open={createJobModalOpen}
        onOpenChange={setCreateJobModalOpen}
        workflowId={workflowId}
        onJobCreate={async (jobData, uploadedFile) => {
          const newJob = await createJob(workflowId, jobData)
          if (uploadedFile && newJob) {
            console.log('🔵 QUEUEING UPLOAD:', uploadedFile.name, 'for job', newJob.name)
            queueUpload(workflowId, newJob.id, newJob.name, uploadedFile)
          }
        }}
      />

      {/* Job Execution Results Modal */}
      {selectedExecution && (
        <JobExecutionModal
          open={executionModalOpen}
          onOpenChange={setExecutionModalOpen}
          jobName={selectedExecution.jobName}
          executionId={selectedExecution.executionId}
        />
      )}

      {/* Metadata Catalog Modal */}
      <MetadataCatalog
        open={metadataCatalogOpen}
        onOpenChange={setMetadataCatalogOpen}
      />

      {/* Delete Job Confirmation Modal */}
      {jobToDelete && (
        <DeleteConfirmationModal
          open={deleteModalOpen}
          onOpenChange={setDeleteModalOpen}
          onConfirm={handleConfirmDeleteJob}
          title="Delete Job"
          description="Are you sure you want to delete this job? This action cannot be undone and will permanently delete all execution history for this job."
          itemName={jobToDelete.name}
          itemType="job"
          isDeleting={isDeleting}
        />
      )}
    </div>
  )
}

