"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions, useJobActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { CreateJobModal, JobExecutionModal } from '@/components/jobs'
import { MetadataCatalog } from '@/components/metadata'
import { ArrowLeft, Play, Pause, Settings, Activity, Clock, User, Building, CheckCircle, XCircle, Loader2, AlertCircle, Database, FileText, Cloud, ArrowRight, Layers } from 'lucide-react'

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

interface WorkflowExecution {
  id: string
  workflowId: string
  status: ExecutionStatus
  startTime: Date
  endTime?: Date
  duration?: number
  logs: string[]
  error?: string
}

export default function WorkflowDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { state } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, isLoading } = useWorkflowActions()
  const { createJob } = useJobActions()
  const [executions, setExecutions] = React.useState<WorkflowExecution[]>([])
  const [loadingExecutions, setLoadingExecutions] = React.useState(false)
  const [createJobModalOpen, setCreateJobModalOpen] = React.useState(false)
  const [runningJobs, setRunningJobs] = React.useState<Set<string>>(new Set())
  const [executionModalOpen, setExecutionModalOpen] = React.useState(false)
  const [selectedExecution, setSelectedExecution] = React.useState<{ jobId: string; jobName: string; executionId: string } | null>(null)
  const [metadataCatalogOpen, setMetadataCatalogOpen] = React.useState(false)
  
  const workflowId = params.id as string
  const workflow = state.workflows.find(w => w.id === workflowId)

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
    
    // Add job to running state
    setRunningJobs(prev => new Set([...prev, jobId]))
    
    try {
      // Simulate job execution process
      console.log(`Starting job execution: ${jobId}`)
      
      // Update job status to running
      // This would typically call an API endpoint
      console.log('Job processing through Bronze/Silver/Gold layers...')
      
      // Simulate processing time (3 seconds)
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Job completed successfully
      console.log(`Job ${jobId} completed successfully`)
      
      // Generate execution ID and show results
      const executionId = `exec_${Date.now()}`
      const job = workflow?.jobs.find(j => j.id === jobId)
      
      if (job) {
        setSelectedExecution({
          jobId,
          jobName: job.name,
          executionId
        })
        setExecutionModalOpen(true)
      }
      
      // Here you would typically:
      // 1. Update job status to 'completed' 
      // 2. Update lastRun timestamp
      // 3. Generate execution logs
      // 4. Store execution results
      
    } catch (error) {
      console.error(`Job ${jobId} failed:`, error)
    } finally {
      // Remove job from running state
      setRunningJobs(prev => {
        const newSet = new Set(prev)
        newSet.delete(jobId)
        return newSet
      })
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
                  .map((job, index) => (
                    <div key={job.id} className="relative">
                      {/* Job Card */}
                      <div className="border border-border rounded-lg p-4 hover:bg-background-secondary transition-colors">
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
                                  job.status === 'completed' ? 'success' :
                                  job.status === 'failed' ? 'destructive' :
                                  job.status === 'running' ? 'default' :
                                  'secondary'
                                }>
                                  {job.status}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground-muted mb-2">{job.description}</p>
                              
                              {/* Source Info */}
                              <div className="text-xs text-foreground-muted">
                                <span className="font-medium">Source:</span> {job.sourceConfig.name} ({job.sourceConfig.type})
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex flex-col gap-2">
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
                                  Run Job
                                </>
                              )}
                            </Button>
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

                        {/* Validation & Transformation Info */}
                        {(job.transformationConfig || job.validationConfig) && (
                          <div className="mt-3 pt-3 border-t border-border text-xs">
                            <div className="flex gap-4">
                              {job.transformationConfig && (
                                <div className="text-foreground-muted">
                                  <span className="font-medium">Transformations:</span> {job.transformationConfig.columnMappings.length} mappings
                                  {job.transformationConfig.lookups && job.transformationConfig.lookups.length > 0 && (
                                    <span>, {job.transformationConfig.lookups.length} lookups</span>
                                  )}
                                </div>
                              )}
                              {job.validationConfig && (
                                <div className="text-foreground-muted">
                                  <span className="font-medium">Validations:</span> 
                                  {job.validationConfig.dataQualityRules?.length || 0} DQ rules,
                                  {job.validationConfig.reconciliationRules?.length || 0} reconciliation rules
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Connector Arrow (except for last job) */}
                      {index < workflow.jobs.length - 1 && (
                        <div className="flex justify-center my-2">
                          <div className="w-6 h-6 bg-primary-50 rounded-full flex items-center justify-center">
                            <ArrowRight className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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
                {executions.map((execution) => (
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
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          }).format(execution.startTime)}
                        </p>
                        {execution.duration && (
                          <p className="text-xs text-foreground-muted">
                            Duration: {Math.floor(execution.duration / 60000)}m {Math.floor((execution.duration % 60000) / 1000)}s
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {execution.error && (
                      <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md">
                        <div className="flex items-center gap-2 text-red-700">
                          <AlertCircle className="w-4 h-4" />
                          <span className="text-sm font-medium">Error</span>
                        </div>
                        <p className="text-sm text-red-600 mt-1">{execution.error}</p>
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <h4 className="text-sm font-medium text-foreground-muted">Execution Log</h4>
                      <div className="bg-background-secondary rounded-md p-3 space-y-1">
                        {execution.logs.map((log, index) => (
                          <div key={index} className="text-sm font-mono text-foreground-muted">
                            <span className="text-xs text-foreground-muted mr-2">
                              {String(index + 1).padStart(2, '0')}:
                            </span>
                            {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
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
        onJobCreate={createJob}
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