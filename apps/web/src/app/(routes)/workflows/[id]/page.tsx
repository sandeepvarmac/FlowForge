"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions } from '@/hooks'
import { WorkflowService } from '@/lib/services/workflow-service'
import { ArrowLeft, Play, Pause, Settings, Activity, Clock, User, Building, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'

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
  const [executions, setExecutions] = React.useState<WorkflowExecution[]>([])
  const [loadingExecutions, setLoadingExecutions] = React.useState(false)
  
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
    </div>
  )
}