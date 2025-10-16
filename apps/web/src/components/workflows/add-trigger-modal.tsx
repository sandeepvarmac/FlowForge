"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Badge, useToast } from '@/components/ui'
import { Clock, Link as LinkIcon, Zap, ArrowRight, AlertCircle, Loader2, Calendar, RefreshCw } from 'lucide-react'
import { TriggersService } from '@/lib/services/triggers-service'
import type { CreateTriggerRequest, TriggerType, DependencyCondition } from '@/types/trigger'

interface AddTriggerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onTriggerCreated?: () => void
}

type Step = 'select-type' | 'configure'

const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *', description: 'Runs 4 times per hour' },
  { label: 'Every hour', value: '0 * * * *', description: 'Runs at the top of every hour' },
  { label: 'Every day at 2 AM', value: '0 2 * * *', description: 'Runs once daily at 2:00 AM' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1', description: 'Runs weekly on Mondays' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5', description: 'Runs Monday through Friday' },
  { label: 'Custom', value: 'custom', description: 'Define your own cron expression' }
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney'
]

export function AddTriggerModal({ open, onOpenChange, workflowId, onTriggerCreated }: AddTriggerModalProps) {
  const { toast } = useToast()
  const [step, setStep] = React.useState<Step>('select-type')
  const [selectedType, setSelectedType] = React.useState<TriggerType | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [loadingPreview, setLoadingPreview] = React.useState(false)
  const [loadingWorkflows, setLoadingWorkflows] = React.useState(false)
  const [validatingDependency, setValidatingDependency] = React.useState(false)

  // Scheduled trigger state
  const [triggerName, setTriggerName] = React.useState('')
  const [cronPreset, setCronPreset] = React.useState('0 2 * * *')
  const [customCron, setCustomCron] = React.useState('')
  const [timezone, setTimezone] = React.useState('UTC')
  const [nextRuns, setNextRuns] = React.useState<number[]>([])

  // Dependency trigger state
  const [dependsOnWorkflowId, setDependsOnWorkflowId] = React.useState('')
  const [dependencyCondition, setDependencyCondition] = React.useState<DependencyCondition>('on_success')
  const [delayMinutes, setDelayMinutes] = React.useState(0)
  const [availableWorkflows, setAvailableWorkflows] = React.useState<Array<{ id: string; name: string }>>([])
  const [dependencyError, setDependencyError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      // Reset state when modal opens
      setStep('select-type')
      setSelectedType(null)
      setTriggerName('')
      setCronPreset('0 2 * * *')
      setCustomCron('')
      setTimezone('UTC')
      setNextRuns([])
      setDependsOnWorkflowId('')
      setDependencyCondition('on_success')
      setDelayMinutes(0)
      setDependencyError(null)
    }
  }, [open])

  React.useEffect(() => {
    if (selectedType === 'dependency') {
      loadAvailableWorkflows()
    }
  }, [selectedType])

  const loadAvailableWorkflows = async () => {
    try {
      setLoadingWorkflows(true)
      const workflows = await TriggersService.getAvailableUpstreamWorkflows()
      // Filter out current workflow
      setAvailableWorkflows(workflows.filter(w => w.id !== workflowId))
    } catch (error) {
      console.error('Failed to load workflows:', error)
      toast({
        type: 'error',
        title: 'Failed to Load Workflows',
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setLoadingWorkflows(false)
    }
  }

  const handleSelectType = (type: TriggerType) => {
    setSelectedType(type)
    setStep('configure')
  }

  const handlePreviewSchedule = async () => {
    const cron = cronPreset === 'custom' ? customCron : cronPreset

    if (!cron) {
      toast({
        type: 'error',
        title: 'Invalid Cron Expression',
        description: 'Please enter a valid cron expression'
      })
      return
    }

    try {
      setLoadingPreview(true)
      const preview = await TriggersService.previewSchedule(workflowId, cron, timezone, 5)
      setNextRuns(preview.nextRuns)
    } catch (error) {
      console.error('Failed to preview schedule:', error)
      toast({
        type: 'error',
        title: 'Invalid Cron Expression',
        description: error instanceof Error ? error.message : 'Failed to preview schedule'
      })
      setNextRuns([])
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleValidateDependency = async () => {
    if (!dependsOnWorkflowId) {
      setDependencyError('Please select an upstream workflow')
      return
    }

    try {
      setValidatingDependency(true)
      setDependencyError(null)

      const validation = await TriggersService.validateDependency(
        workflowId,
        dependsOnWorkflowId
      )

      if (!validation.valid) {
        setDependencyError(validation.message || 'This dependency would create a circular reference')
      } else {
        toast({
          type: 'success',
          title: 'Dependency Valid',
          description: 'This dependency configuration is valid'
        })
      }
    } catch (error) {
      console.error('Failed to validate dependency:', error)
      setDependencyError(error instanceof Error ? error.message : 'Failed to validate dependency')
    } finally {
      setValidatingDependency(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedType) return

    const requestData: CreateTriggerRequest = {
      triggerType: selectedType,
      triggerName: triggerName || undefined,
      enabled: true
    }

    if (selectedType === 'scheduled') {
      const cron = cronPreset === 'custom' ? customCron : cronPreset

      if (!cron) {
        toast({
          type: 'error',
          title: 'Invalid Configuration',
          description: 'Please enter a valid cron expression'
        })
        return
      }

      requestData.cronExpression = cron
      requestData.timezone = timezone
    }

    if (selectedType === 'dependency') {
      if (!dependsOnWorkflowId) {
        toast({
          type: 'error',
          title: 'Invalid Configuration',
          description: 'Please select an upstream workflow'
        })
        return
      }

      // Validate dependency before creating
      try {
        const validation = await TriggersService.validateDependency(
          workflowId,
          dependsOnWorkflowId
        )

        if (!validation.valid) {
          toast({
            type: 'error',
            title: 'Invalid Dependency',
            description: validation.message || 'This dependency would create a circular reference'
          })
          return
        }
      } catch (error) {
        toast({
          type: 'error',
          title: 'Validation Failed',
          description: error instanceof Error ? error.message : 'Failed to validate dependency'
        })
        return
      }

      requestData.dependsOnWorkflowId = dependsOnWorkflowId
      requestData.dependencyCondition = dependencyCondition
      requestData.delayMinutes = delayMinutes
    }

    try {
      setCreating(true)
      await TriggersService.createTrigger(workflowId, requestData)

      toast({
        type: 'success',
        title: 'Trigger Created',
        description: `${selectedType} trigger has been created successfully`
      })

      onOpenChange(false)
      onTriggerCreated?.()
    } catch (error) {
      console.error('Failed to create trigger:', error)
      toast({
        type: 'error',
        title: 'Failed to Create Trigger',
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setCreating(false)
    }
  }

  const renderTypeSelector = () => (
    <div className="space-y-4">
      <div className="grid gap-4">
        {/* Scheduled Trigger Card */}
        <button
          onClick={() => handleSelectType('scheduled')}
          className="flex items-start gap-4 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary-50/30 transition-all text-left group"
        >
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-blue-100 transition-colors">
            <Clock className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Time-Based Trigger</h3>
              <Badge variant="default">Scheduled</Badge>
            </div>
            <p className="text-sm text-foreground-muted">
              Run workflow on a schedule using cron expressions
            </p>
            <p className="text-xs text-foreground-muted mt-2">
              Examples: Daily at 2 AM, Every 15 minutes, Weekdays at 9 AM
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted group-hover:text-primary transition-colors flex-shrink-0" />
        </button>

        {/* Dependency Trigger Card */}
        <button
          onClick={() => handleSelectType('dependency')}
          className="flex items-start gap-4 p-4 border-2 border-border rounded-lg hover:border-primary hover:bg-primary-50/30 transition-all text-left group"
        >
          <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-purple-100 transition-colors">
            <LinkIcon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Dependency-Based Trigger</h3>
              <Badge variant="secondary">Workflow</Badge>
            </div>
            <p className="text-sm text-foreground-muted">
              Run workflow after another workflow completes
            </p>
            <p className="text-xs text-foreground-muted mt-2">
              Examples: After customer ingestion, After ETL pipeline, On failure
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-foreground-muted group-hover:text-primary transition-colors flex-shrink-0" />
        </button>

        {/* Event-Driven Trigger Card (Coming Soon) */}
        <div className="flex items-start gap-4 p-4 border-2 border-border rounded-lg opacity-60 cursor-not-allowed">
          <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <Zap className="w-6 h-6 text-yellow-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">Event-Driven Trigger</h3>
              <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
            </div>
            <p className="text-sm text-foreground-muted">
              Run workflow on external events (webhooks, file arrival, etc.)
            </p>
            <p className="text-xs text-foreground-muted mt-2">
              Examples: Webhook from GitHub, File lands in S3, Database change
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  const renderScheduledForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trigger-name">Trigger Name (Optional)</Label>
        <Input
          id="trigger-name"
          placeholder="e.g., Daily Customer Import"
          value={triggerName}
          onChange={(e) => setTriggerName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="cron-preset">Schedule Preset</Label>
        <Select value={cronPreset} onValueChange={setCronPreset}>
          <SelectTrigger id="cron-preset">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CRON_PRESETS.map((preset) => (
              <SelectItem key={preset.value} value={preset.value}>
                <div className="flex flex-col">
                  <span>{preset.label}</span>
                  <span className="text-xs text-foreground-muted">{preset.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {cronPreset === 'custom' && (
        <div>
          <Label htmlFor="custom-cron">Custom Cron Expression</Label>
          <Input
            id="custom-cron"
            placeholder="* * * * *"
            value={customCron}
            onChange={(e) => setCustomCron(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-foreground-muted mt-1">
            Format: minute hour day month weekday
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="timezone">Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger id="timezone">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="pt-2">
        <Button
          variant="outline"
          onClick={handlePreviewSchedule}
          disabled={loadingPreview}
          className="w-full"
        >
          {loadingPreview ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calendar className="w-4 h-4 mr-2" />
              Preview Next 5 Runs
            </>
          )}
        </Button>
      </div>

      {nextRuns.length > 0 && (
        <div className="p-4 bg-primary-50/50 border border-primary-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-primary" />
            <h4 className="font-semibold text-sm text-foreground">Next 5 Scheduled Runs</h4>
          </div>
          <div className="space-y-2">
            {nextRuns.map((timestamp, index) => (
              <div key={timestamp} className="text-sm text-foreground-muted">
                {index + 1}. {new Date(timestamp * 1000).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: timezone
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderDependencyForm = () => (
    <div className="space-y-4">
      <div>
        <Label htmlFor="trigger-name-dep">Trigger Name (Optional)</Label>
        <Input
          id="trigger-name-dep"
          placeholder="e.g., After Customer Ingestion"
          value={triggerName}
          onChange={(e) => setTriggerName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="upstream-workflow">Upstream Workflow</Label>
        <Select value={dependsOnWorkflowId} onValueChange={(value) => {
          setDependsOnWorkflowId(value)
          setDependencyError(null)
        }}>
          <SelectTrigger id="upstream-workflow">
            <SelectValue placeholder="Select a workflow..." />
          </SelectTrigger>
          <SelectContent>
            {loadingWorkflows ? (
              <div className="p-4 text-center text-sm text-foreground-muted">
                <Loader2 className="w-4 h-4 mx-auto mb-2 animate-spin" />
                Loading workflows...
              </div>
            ) : availableWorkflows.length === 0 ? (
              <div className="p-4 text-center text-sm text-foreground-muted">
                No workflows available
              </div>
            ) : (
              availableWorkflows.map((workflow) => (
                <SelectItem key={workflow.id} value={workflow.id}>
                  {workflow.name}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <p className="text-xs text-foreground-muted mt-1">
          This workflow will run after the selected workflow completes
        </p>
      </div>

      <div>
        <Label htmlFor="dependency-condition">Trigger Condition</Label>
        <Select value={dependencyCondition} onValueChange={(value) => setDependencyCondition(value as DependencyCondition)}>
          <SelectTrigger id="dependency-condition">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on_success">
              <div className="flex flex-col">
                <span>On Success</span>
                <span className="text-xs text-foreground-muted">Run only if upstream succeeds</span>
              </div>
            </SelectItem>
            <SelectItem value="on_failure">
              <div className="flex flex-col">
                <span>On Failure</span>
                <span className="text-xs text-foreground-muted">Run only if upstream fails</span>
              </div>
            </SelectItem>
            <SelectItem value="on_completion">
              <div className="flex flex-col">
                <span>On Completion</span>
                <span className="text-xs text-foreground-muted">Run regardless of upstream status</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="delay-minutes">Delay (minutes)</Label>
        <Input
          id="delay-minutes"
          type="number"
          min="0"
          max="60"
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(parseInt(e.target.value) || 0)}
        />
        <p className="text-xs text-foreground-muted mt-1">
          Wait time before triggering (0-60 minutes)
        </p>
      </div>

      {dependsOnWorkflowId && (
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={handleValidateDependency}
            disabled={validatingDependency}
            className="w-full"
          >
            {validatingDependency ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Validating...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Validate Dependency
              </>
            )}
          </Button>
        </div>
      )}

      {dependencyError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm font-medium">Invalid Dependency</span>
          </div>
          <p className="text-sm text-red-600 mt-1">{dependencyError}</p>
        </div>
      )}
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 'select-type' ? 'Add Trigger' : `Configure ${selectedType} Trigger`}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-type'
              ? 'Choose the type of trigger to add to this workflow'
              : 'Configure the trigger settings below'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {step === 'select-type' && renderTypeSelector()}
          {step === 'configure' && selectedType === 'scheduled' && renderScheduledForm()}
          {step === 'configure' && selectedType === 'dependency' && renderDependencyForm()}
        </div>

        {step === 'configure' && (
          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => setStep('select-type')}
              disabled={creating}
            >
              Back
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || (selectedType === 'dependency' && !!dependencyError)}
            >
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Trigger'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
