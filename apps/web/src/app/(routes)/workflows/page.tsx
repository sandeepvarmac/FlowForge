"use client"

import * as React from "react"
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } from '@/components/ui'
import { CreateWorkflowModal } from '@/components/workflows/create-workflow-modal'
import { useAppContext } from '@/lib/context/app-context'
import { useWorkflowActions } from '@/hooks'
import { Search, Filter, MoreVertical, Play, Pause, Settings, Loader2, Eye } from 'lucide-react'
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

export default function WorkflowsPage() {
  const router = useRouter()
  const { state } = useAppContext()
  const { runWorkflow, pauseWorkflow, resumeWorkflow, isLoading, error } = useWorkflowActions()
  const [createModalOpen, setCreateModalOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('all')

  // Filter workflows based on search and status
  const filteredWorkflows = state.workflows.filter(workflow => {
    const matchesSearch = workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         workflow.application.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleWorkflowAction = async (workflowId: string, action: 'run' | 'pause' | 'resume' | 'edit' | 'view') => {
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
            className="px-3 py-2 border border-border rounded-md bg-background-secondary text-sm"
          >
            <option value="all">All Status</option>
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
          <Button variant="outline" size="sm">
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
          filteredWorkflows.map((workflow) => (
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
                    {/* Quick Actions */}
                    <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(workflow.status === 'manual' || workflow.status === 'completed' || workflow.status === 'failed') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWorkflowAction(workflow.id, 'run')}
                          disabled={isLoading(workflow.id, 'run')}
                          className="h-8 w-8 p-0"
                        >
                          {isLoading(workflow.id, 'run') ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {workflow.status === 'scheduled' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWorkflowAction(workflow.id, 'pause')}
                          disabled={isLoading(workflow.id, 'pause')}
                          className="h-8 w-8 p-0"
                        >
                          {isLoading(workflow.id, 'pause') ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Pause className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {workflow.status === 'paused' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleWorkflowAction(workflow.id, 'resume')}
                          disabled={isLoading(workflow.id, 'resume')}
                          className="h-8 w-8 p-0"
                        >
                          {isLoading(workflow.id, 'resume') ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWorkflowAction(workflow.id, 'view')}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleWorkflowAction(workflow.id, 'edit')}
                        className="h-8 w-8 p-0"
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    {/* More Actions Menu */}
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Workflow Modal */}
      <CreateWorkflowModal 
        open={createModalOpen} 
        onOpenChange={setCreateModalOpen} 
      />
    </div>
  )
}

