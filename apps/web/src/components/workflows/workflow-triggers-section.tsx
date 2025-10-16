"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, Switch, useToast } from '@/components/ui'
import { Plus, Clock, Link as LinkIcon, Zap, Trash2, Loader2, Calendar, AlertCircle } from 'lucide-react'
import { TriggersService } from '@/lib/services/triggers-service'
import type { WorkflowTrigger } from '@/types/trigger'
import { formatDistanceToNow } from 'date-fns'

interface WorkflowTriggersSectionProps {
  workflowId: string
  onAddTrigger: () => void
}

const getTriggerIcon = (triggerType: string) => {
  switch (triggerType) {
    case 'scheduled':
      return <Clock className="w-4 h-4" />
    case 'dependency':
      return <LinkIcon className="w-4 h-4" />
    case 'event':
      return <Zap className="w-4 h-4" />
    default:
      return <Calendar className="w-4 h-4" />
  }
}

const getTriggerBadgeVariant = (triggerType: string) => {
  switch (triggerType) {
    case 'scheduled':
      return 'default'
    case 'dependency':
      return 'secondary'
    case 'event':
      return 'warning'
    default:
      return 'secondary'
  }
}

const formatTriggerDescription = (trigger: WorkflowTrigger): string => {
  if (trigger.triggerType === 'scheduled') {
    if (trigger.cronExpression) {
      return `Runs ${trigger.cronExpression} (${trigger.timezone || 'UTC'})`
    }
    return 'Scheduled trigger'
  }

  if (trigger.triggerType === 'dependency') {
    const condition = trigger.dependencyCondition || 'on_success'
    const conditionText = condition === 'on_success'
      ? 'succeeds'
      : condition === 'on_failure'
      ? 'fails'
      : 'completes'

    return `Runs after upstream workflow ${conditionText}`
  }

  if (trigger.triggerType === 'event') {
    return 'Event-driven trigger'
  }

  return 'Manual trigger'
}

const formatNextRun = (nextRunAt?: number): string => {
  if (!nextRunAt) return 'Not scheduled'

  const nextRun = new Date(nextRunAt * 1000)
  const now = new Date()

  if (nextRun < now) {
    return 'Overdue'
  }

  return formatDistanceToNow(nextRun, { addSuffix: true })
}

export function WorkflowTriggersSection({ workflowId, onAddTrigger }: WorkflowTriggersSectionProps) {
  const { toast } = useToast()
  const [triggers, setTriggers] = React.useState<WorkflowTrigger[]>([])
  const [loading, setLoading] = React.useState(true)
  const [toggling, setToggling] = React.useState<Set<string>>(new Set())
  const [deleting, setDeleting] = React.useState<Set<string>>(new Set())

  const loadTriggers = React.useCallback(async () => {
    try {
      setLoading(true)
      const data = await TriggersService.getTriggers(workflowId)
      setTriggers(data)
    } catch (error) {
      console.error('Failed to load triggers:', error)
      toast({
        type: 'error',
        title: 'Failed to Load Triggers',
        description: error instanceof Error ? error.message : 'An error occurred while loading triggers'
      })
    } finally {
      setLoading(false)
    }
  }, [workflowId, toast])

  React.useEffect(() => {
    loadTriggers()
  }, [loadTriggers])

  const handleToggle = async (triggerId: string, currentlyEnabled: boolean) => {
    setToggling(prev => new Set([...prev, triggerId]))

    try {
      if (currentlyEnabled) {
        await TriggersService.disableTrigger(workflowId, triggerId)
        toast({
          type: 'success',
          title: 'Trigger Disabled',
          description: 'The trigger has been disabled successfully'
        })
      } else {
        await TriggersService.enableTrigger(workflowId, triggerId)
        toast({
          type: 'success',
          title: 'Trigger Enabled',
          description: 'The trigger has been enabled successfully'
        })
      }

      // Reload triggers to get updated state
      await loadTriggers()
    } catch (error) {
      console.error('Failed to toggle trigger:', error)
      toast({
        type: 'error',
        title: 'Failed to Toggle Trigger',
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setToggling(prev => {
        const newSet = new Set(prev)
        newSet.delete(triggerId)
        return newSet
      })
    }
  }

  const handleDelete = async (triggerId: string, triggerName: string) => {
    if (!confirm(`Are you sure you want to delete the trigger "${triggerName}"? This action cannot be undone.`)) {
      return
    }

    setDeleting(prev => new Set([...prev, triggerId]))

    try {
      await TriggersService.deleteTrigger(workflowId, triggerId)
      toast({
        type: 'success',
        title: 'Trigger Deleted',
        description: `"${triggerName}" has been deleted successfully`
      })

      // Reload triggers
      await loadTriggers()
    } catch (error) {
      console.error('Failed to delete trigger:', error)
      toast({
        type: 'error',
        title: 'Failed to Delete Trigger',
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setDeleting(prev => {
        const newSet = new Set(prev)
        newSet.delete(triggerId)
        return newSet
      })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Zap className="w-5 h-5" />
          Triggers ({triggers.length})
        </CardTitle>
        <Button
          variant="outline"
          onClick={onAddTrigger}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Trigger
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 mx-auto mb-3 animate-spin text-primary" />
            <p className="text-foreground-muted">Loading triggers...</p>
          </div>
        ) : triggers.length === 0 ? (
          <div className="text-center py-8 text-foreground-muted">
            <Zap className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="font-medium mb-1">No triggers configured</p>
            <p className="text-sm mb-4">Add triggers to automate workflow execution</p>
            <Button onClick={onAddTrigger}>
              <Plus className="w-4 h-4 mr-2" />
              Add First Trigger
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {triggers.map((trigger) => (
              <div
                key={trigger.id}
                className="flex items-start justify-between p-4 border border-border rounded-lg hover:border-primary-200 hover:shadow-sm transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      trigger.triggerType === 'scheduled'
                        ? 'bg-blue-50 text-blue-600'
                        : trigger.triggerType === 'dependency'
                        ? 'bg-purple-50 text-purple-600'
                        : 'bg-yellow-50 text-yellow-600'
                    }`}>
                      {getTriggerIcon(trigger.triggerType)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-foreground">
                          {trigger.triggerName || `${trigger.triggerType} trigger`}
                        </h4>
                        <Badge variant={getTriggerBadgeVariant(trigger.triggerType)}>
                          {trigger.triggerType}
                        </Badge>
                        {!trigger.enabled && (
                          <Badge variant="secondary" className="text-xs">
                            Disabled
                          </Badge>
                        )}
                      </div>

                      <p className="text-sm text-foreground-muted">
                        {formatTriggerDescription(trigger)}
                      </p>

                      {trigger.triggerType === 'scheduled' && trigger.nextRunAt && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-foreground-muted">
                          <Clock className="w-3 h-3" />
                          <span>Next run: {formatNextRun(trigger.nextRunAt)}</span>
                        </div>
                      )}

                      {trigger.triggerType === 'dependency' && trigger.delayMinutes && trigger.delayMinutes > 0 && (
                        <div className="flex items-center gap-2 mt-2 text-xs text-foreground-muted">
                          <AlertCircle className="w-3 h-3" />
                          <span>Delay: {trigger.delayMinutes} minutes after completion</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-foreground-muted">
                      {trigger.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={trigger.enabled}
                      onCheckedChange={() => handleToggle(trigger.id, trigger.enabled)}
                      disabled={toggling.has(trigger.id)}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(trigger.id, trigger.triggerName || 'Unnamed trigger')}
                    disabled={deleting.has(trigger.id)}
                  >
                    {deleting.has(trigger.id) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
