"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions, useJobActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { CreateJobModal, JobExecutionModal, JobCard } from '@/components/jobs'
import type { Job } from '@/types/workflow'
import { MetadataCatalog } from '@/components/metadata'
import { ArrowLeft, Play, Pause, Settings, Activity, Clock, User, Building, CheckCircle, XCircle, Loader2, AlertCircle, Database, FileText, Cloud, ArrowRight, Layers } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

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
  jobId: string
  jobName?: string
  status: ExecutionStatus
  startedAt?: Date
  completedAt?: Date
  durationMs?: number
  recordsProcessed?: number
  landingKey?: string
  bronzeFilePath?: string
  silverFilePath?: string
  goldFilePath?: string
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
}

const formatDateTime = (value?: Date) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
}

const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs <= 0) return '—'
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
  if (typeof value !== 'number' || value < 0) return '—'
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(value)
}

export default function WorkflowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { state } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, isLoading } = useWorkflowActions()
  const { createJob, uploadFile } = useJobActions()
  const [executions, setExecutions] = React.useState<WorkflowExecution[]>([])
  const [loadingExecutions, setLoadingExecutions] = React.useState(false)
  const [createJobModalOpen, setCreateJobModalOpen] = React.useState(false)
  const [runningJobs, setRunningJobs] = React.useState<Set<string>>(new Set())
  const [executionModalOpen, setExecutionModalOpen] = React.useState(false)
  const [selectedExecution, setSelectedExecution] = React.useState<{ jobId: string; jobName: string; executionId: string } | null>(null)
  const [metadataCatalogOpen, setMetadataCatalogOpen] = React.useState(false)
  const [editingJob, setEditingJob] = React.useState<Job | null>(null)
  
  const workflowId = params.id as string
  const workflow = state.workflows.find(w => w.id === workflowId)
  const latestExecution = React.useMemo(() => (executions.length > 0 ? executions[0] : undefined), [executions])
  const jobExecutionLookup = React.useMemo(() => {
    if (!latestExecution?.jobExecutions) {
      return {} as Record<string, JobExecutionDetail>
    }

    const lookup: Record<string, JobExecutionDetail> = {}

    latestExecution.jobExecutions.forEach((jobExec: any) => {
      const jobId = jobExec.jobId ?? jobExec.job_id
      if (!jobId) return

      lookup[jobId] = {
        jobId,
        jobName: jobExec.jobName ?? jobExec.job_name,
        status: jobExec.status as ExecutionStatus,
        startedAt: jobExec.startedAt instanceof Date ? jobExec.startedAt : jobExec.startedAt ? new Date(jobExec.startedAt) : undefined,
        completedAt: jobExec.completedAt instanceof Date ? jobExec.completedAt : jobExec.completedAt ? new Date(jobExec.completedAt) : undefined,
        durationMs: typeof jobExec.durationMs === 'number' ? jobExec.durationMs : undefined,
        recordsProcessed: typeof jobExec.recordsProcessed === 'number' ? jobExec.recordsProcessed : undefined,
        landingKey: jobExec.landingKey ?? jobExec.landing_key,
        bronzeFilePath: jobExec.bronzeFilePath ?? jobExec.bronze_file_path,
        silverFilePath: jobExec.silverFilePath ?? jobExec.silver_file_path,
        goldFilePath: jobExec.goldFilePath ?? jobExec.gold_file_path
      }
    })

    return lookup
  }, [latestExecution])

  React.useEffect(() => {
    if (workflow) {
      loadExecutions()
    }
  }, [workflow])

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

  const handleEditJob = (job: Job) => {
    setEditingJob(job)
    setCreateJobModalOpen(true)
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
                  .slice()
                  .sort((a, b) => a.order - b.order)
                  .map((job, index) => {
                    return (
                      <React.Fragment key={job.id}>
                        <JobCard
                          job={job}
                          workflowId={workflowId}
                          onRunJob={handleRunJob}
                          onEditJob={handleEditJob}
                          isRunning={runningJobs.has(job.id)}
                        />

                        {index < workflow.jobs.length - 1 && (
                          <div className="flex justify-center my-2">
                            <div className="w-6 h-6 bg-primary-50 rounded-full flex items-center justify-center">
                              <ArrowRight className="w-4 h-4 text-primary" />
                            </div>
                          </div>
                        )}
                      </React.Fragment>
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
                  const jobExecutions = execution.jobExecutions || []
                  const completedJobs = jobExecutions.filter((je: any) => je.status === 'completed').length
                  const failedJobs = jobExecutions.filter((je: any) => je.status === 'failed').length
                  const runningJobs = jobExecutions.filter((je: any) => je.status === 'running').length

                  return (
                    <Card key={execution.id} className="border-2">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
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
                            <span className="text-sm font-medium text-foreground">
                              {execution.startTime && formatDistanceToNow(execution.startTime, { addSuffix: true })}
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-foreground">
                              {execution.startTime && new Intl.DateTimeFormat('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              }).format(execution.startTime)}
                            </p>
                            {execution.duration && execution.duration > 0 && (
                              <p className="text-xs text-foreground-muted">
                                Duration: {formatDuration(execution.duration)}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-4">
                        {/* Job Summary */}
                        <div className="flex items-center gap-4 text-sm pb-3 border-b border-border">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground-muted">Jobs:</span>
                            <span className="font-semibold text-foreground">{jobExecutions.length} total</span>
                          </div>
                          {completedJobs > 0 && (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                              <span className="font-medium text-green-700">{completedJobs} completed</span>
                            </div>
                          )}
                          {runningJobs > 0 && (
                            <div className="flex items-center gap-1">
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                              <span className="font-medium text-primary">{runningJobs} running</span>
                            </div>
                          )}
                          {failedJobs > 0 && (
                            <div className="flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-red-600" />
                              <span className="font-medium text-red-700">{failedJobs} failed</span>
                            </div>
                          )}
                        </div>

                        {/* Global Error */}
                        {execution.error && (
                          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="flex items-center gap-2 text-red-700">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">Execution Error</span>
                            </div>
                            <p className="text-sm text-red-600 mt-1">{execution.error}</p>
                          </div>
                        )}

                        {/* Job Execution Details */}
                        {jobExecutions.length > 0 && (
                          <details open={execution.status === 'failed' || execution.status === 'running'}>
                            <summary className="cursor-pointer text-sm font-medium text-foreground-muted hover:text-foreground transition-colors mb-3">
                              Job Details ({jobExecutions.length} jobs)
                            </summary>
                            <div className="space-y-3 ml-2">
                              {jobExecutions.map((jobExec: any) => {
                                const job = workflow?.jobs.find((j: any) => j.id === jobExec.jobId)
                                const jobName = job?.name || `Job ${jobExec.jobId}`

                                return (
                                  <details key={jobExec.id} className="border border-border rounded-lg">
                                    <summary className="p-3 cursor-pointer list-none hover:bg-background-secondary transition-colors">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-foreground">{jobName}</span>
                                          <Badge
                                            variant={
                                              jobExec.status === 'completed'
                                                ? 'success'
                                                : jobExec.status === 'failed'
                                                ? 'destructive'
                                                : jobExec.status === 'running'
                                                ? 'default'
                                                : 'secondary'
                                            }
                                          >
                                            {jobExec.status}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-foreground-muted">
                                          {jobExec.recordsProcessed > 0 && `${jobExec.recordsProcessed.toLocaleString()} rows`}
                                          {jobExec.durationMs && ` • ${formatDuration(jobExec.durationMs)}`}
                                        </div>
                                      </div>
                                    </summary>

                                    {/* Medallion Layer Progression */}
                                    <div className="px-3 pb-3 pt-2 border-t border-border space-y-3">
                                      {/* Landing Layer */}
                                      <div className="flex items-start gap-3 p-2 bg-blue-50 rounded-md">
                                        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                          L
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-sm text-blue-900">Landing</div>
                                          <div className="text-xs text-blue-700 font-mono break-all">
                                            {jobExec.landingKey || 'N/A'}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Bronze Layer */}
                                      {jobExec.bronzeFilePath && (
                                        <>
                                          <div className="ml-3 text-foreground-muted text-sm">↓</div>
                                          <div className="flex items-start gap-3 p-2 bg-amber-50 rounded-md">
                                            <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              B
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm text-amber-900">Bronze</div>
                                              <div className="text-xs text-amber-700 font-mono break-all">
                                                {jobExec.bronzeFilePath}
                                              </div>
                                              {jobExec.recordsProcessed > 0 && (
                                                <div className="text-xs text-amber-600 mt-1">
                                                  {jobExec.recordsProcessed.toLocaleString()} rows ingested
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      )}

                                      {/* Silver Layer */}
                                      {jobExec.silverFilePath && (
                                        <>
                                          <div className="ml-3 text-foreground-muted text-sm">↓</div>
                                          <div className="flex items-start gap-3 p-2 bg-gray-50 rounded-md">
                                            <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              S
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm text-gray-900">Silver</div>
                                              <div className="text-xs text-gray-700 font-mono break-all">
                                                {jobExec.silverFilePath}
                                              </div>
                                              {jobExec.silverRowCount > 0 && (
                                                <div className="text-xs text-gray-600 mt-1">
                                                  {jobExec.silverRowCount.toLocaleString()} rows after deduplication
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      )}

                                      {/* Gold Layer */}
                                      {jobExec.goldFilePath && (
                                        <>
                                          <div className="ml-3 text-foreground-muted text-sm">↓</div>
                                          <div className="flex items-start gap-3 p-2 bg-yellow-50 rounded-md">
                                            <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                              G
                                            </div>
                                            <div className="flex-1 min-w-0">
                                              <div className="font-medium text-sm text-yellow-900">Gold</div>
                                              <div className="text-xs text-yellow-700 font-mono break-all">
                                                {jobExec.goldFilePath}
                                              </div>
                                              {jobExec.goldRowCount > 0 && (
                                                <div className="text-xs text-yellow-600 mt-1">
                                                  {jobExec.goldRowCount.toLocaleString()} rows published
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </>
                                      )}

                                      {/* Job Error */}
                                      {jobExec.error && (
                                        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
                                          <div className="flex items-center gap-2 text-red-700">
                                            <AlertCircle className="w-4 h-4" />
                                            <span className="text-xs font-medium">Job Error</span>
                                          </div>
                                          <p className="text-xs text-red-600 mt-1 font-mono">{jobExec.error}</p>
                                        </div>
                                      )}
                                    </div>
                                  </details>
                                )
                              })}
                            </div>
                          </details>
                        )}

                        {/* Execution Logs */}
                        {execution.logs && execution.logs.length > 0 && (
                          <details className="border-t border-border pt-3">
                            <summary className="cursor-pointer text-sm font-medium text-foreground-muted hover:text-foreground transition-colors mb-2">
                              Execution Logs ({execution.logs.length} entries)
                            </summary>
                            <div className="bg-background-secondary rounded-md p-3 space-y-1 max-h-60 overflow-y-auto">
                              {execution.logs.map((log: string, index: number) => (
                                <div key={index} className="text-xs font-mono text-foreground-muted">
                                  <span className="text-foreground-muted/60 mr-2">
                                    {String(index + 1).padStart(3, '0')}
                                  </span>
                                  {log}
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
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
        onJobCreate={async (jobData, file) => {
          const newJob = await createJob(workflowId, jobData)
          if (file && newJob?.id) {
            await uploadFile(workflowId, newJob.id, file)
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
    </div>
  )
}
