"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, Button, Badge, Input } from '@/components/ui'
import { FormField, FormLabel, FormError, Select } from '@/components/ui/form'
import { Clock, GitBranch, Zap, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TriggersService } from '@/lib/services/triggers-service'
import type { TriggerType, DependencyCondition } from '@/types/trigger'
import { useAppContext } from '@/lib/context/app-context'
import { useToast } from '@/components/ui/toast'

interface AddTriggerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onTriggerCreated?: () => void
}

// Cron presets
const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 2 AM', value: '0 2 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Custom', value: 'custom' }
]

// Trigger type options
const triggerTypes = [
  {
    value: 'scheduled',
    label: 'Scheduled',
    icon: Clock,
    description: 'Run on a recurring schedule (cron expression)',
    color: 'blue',
    enabled: true
  },
  {
    value: 'dependency',
    label: 'Dependency',
    icon: GitBranch,
    description: 'Run after another workflow completes',
    color: 'purple',
    enabled: true
  },
  {
    value: 'event',
    label: 'Event-driven',
    icon: Zap,
    description: 'Run when an event occurs (webhook, file arrival)',
    color: 'yellow',
    enabled: false,
    badge: 'Coming Soon'
  }
]

export function AddTriggerModal({ open, onOpenChange, workflowId, onTriggerCreated }: AddTriggerModalProps) {
  const { state } = useAppContext()
  const { toast } = useToast()
  const [step, setStep] = React.useState<1 | 2>(1) // 1: Select type, 2: Configure
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Form state
  const [selectedType, setSelectedType] = React.useState<TriggerType | null>(null)
  const [triggerName, setTriggerName] = React.useState('')

  // Scheduled trigger config
  const [cronPreset, setCronPreset] = React.useState('0 2 * * *')
  const [customCron, setCustomCron] = React.useState('')
  const [timezone, setTimezone] = React.useState('UTC')

  // Dependency trigger config
  const [upstreamWorkflowId, setUpstreamWorkflowId] = React.useState('')
  const [dependencyCondition, setDependencyCondition] = React.useState<DependencyCondition>('on_success')

  const resetForm = () => {
    setStep(1)
    setSelectedType(null)
    setTriggerName('')
    setCronPreset('0 2 * * *')
    setCustomCron('')
    setTimezone('UTC')
    setUpstreamWorkflowId('')
    setDependencyCondition('on_success')
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleTypeSelect = (type: TriggerType) => {
    setSelectedType(type)
    setStep(2)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!triggerName.trim()) {
      newErrors.triggerName = 'Trigger name is required'
    }

    if (selectedType === 'scheduled') {
      const cronExpression = cronPreset === 'custom' ? customCron : cronPreset
      if (!cronExpression.trim()) {
        newErrors.cron = 'Cron expression is required'
      }
    }

    if (selectedType === 'dependency') {
      if (!upstreamWorkflowId) {
        newErrors.upstream = 'Please select an upstream workflow'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm() || !selectedType) return

    setLoading(true)
    try {
      if (selectedType === 'scheduled') {
        const cronExpression = cronPreset === 'custom' ? customCron : cronPreset
        await TriggersService.createTrigger(workflowId, {
          triggerName: triggerName,
          triggerType: 'scheduled',
          enabled: true,
          cronExpression: cronExpression,
          timezone: timezone
        })
      } else if (selectedType === 'dependency') {
        const upstreamWorkflow = state.workflows.find(w => w.id === upstreamWorkflowId)
        await TriggersService.createTrigger(workflowId, {
          triggerName: triggerName,
          triggerType: 'dependency',
          enabled: true,
          dependsOnWorkflowId: upstreamWorkflowId,
          dependencyCondition: dependencyCondition
        })
      }

      toast({
        type: 'success',
        title: 'Trigger Created',
        description: `"${triggerName}" has been created successfully`
      })

      onTriggerCreated?.()
      handleClose()
    } catch (error) {
      console.error('Failed to create trigger:', error)
      toast({
        type: 'error',
        title: 'Failed to Create Trigger',
        description: error instanceof Error ? error.message : 'An error occurred'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Trigger</DialogTitle>
          <DialogDescription>
            {step === 1
              ? 'Select the type of trigger to automate workflow execution'
              : `Configure ${triggerTypes.find(t => t.value === selectedType)?.label} trigger`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Select Trigger Type */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-900 mb-1">How Triggers Work</h4>
                    <p className="text-sm text-blue-800">
                      Triggers automate workflow execution. You can have multiple triggers on the same workflow - each trigger fires the workflow independently (OR logic).
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {triggerTypes.map((type) => {
                  const Icon = type.icon
                  const colorClasses = {
                    blue: {
                      bg: 'bg-blue-50',
                      text: 'text-blue-600',
                      border: 'border-blue-200',
                      hover: 'hover:border-blue-300 hover:shadow-md'
                    },
                    purple: {
                      bg: 'bg-purple-50',
                      text: 'text-purple-600',
                      border: 'border-purple-200',
                      hover: 'hover:border-purple-300 hover:shadow-md'
                    },
                    yellow: {
                      bg: 'bg-yellow-50',
                      text: 'text-yellow-600',
                      border: 'border-yellow-200',
                      hover: 'hover:border-yellow-300'
                    }
                  }[type.color]

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => type.enabled && handleTypeSelect(type.value as TriggerType)}
                      disabled={!type.enabled}
                      className={cn(
                        'p-5 border-2 rounded-lg text-left transition-all relative',
                        type.enabled
                          ? `${colorClasses.border} ${colorClasses.hover} cursor-pointer`
                          : 'border-border bg-gray-50 opacity-60 cursor-not-allowed'
                      )}
                    >
                      {type.badge && (
                        <Badge className="absolute top-3 right-3 text-xs" variant="secondary">
                          {type.badge}
                        </Badge>
                      )}

                      <div className="flex items-start gap-4">
                        <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center', colorClasses.bg)}>
                          <Icon className={cn('w-6 h-6', colorClasses.text)} />
                        </div>

                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground mb-1">{type.label}</h3>
                          <p className="text-sm text-foreground-muted leading-relaxed">
                            {type.description}
                          </p>
                        </div>

                        {type.enabled && (
                          <ArrowRight className="w-5 h-5 text-foreground-muted ml-2" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Step 2: Configure Trigger */}
          {step === 2 && selectedType === 'scheduled' && (
            <div className="space-y-6">
              <FormField>
                <FormLabel required>Trigger Name</FormLabel>
                <Input
                  value={triggerName}
                  onChange={(e) => setTriggerName(e.target.value)}
                  placeholder="e.g., Daily Import at 2 AM"
                  autoFocus
                />
                {errors.triggerName && <FormError>{errors.triggerName}</FormError>}
              </FormField>

              <FormField>
                <FormLabel required>Schedule</FormLabel>
                <Select
                  value={cronPreset}
                  onChange={(e) => setCronPreset(e.target.value)}
                >
                  {CRON_PRESETS.map(preset => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </Select>
              </FormField>

              {cronPreset === 'custom' && (
                <FormField>
                  <FormLabel required>Custom Cron Expression</FormLabel>
                  <Input
                    value={customCron}
                    onChange={(e) => setCustomCron(e.target.value)}
                    placeholder="0 2 * * *"
                  />
                  <p className="text-xs text-foreground-muted mt-1">
                    Format: minute hour day month weekday (e.g., "0 2 * * *" = daily at 2 AM)
                  </p>
                  {errors.cron && <FormError>{errors.cron}</FormError>}
                </FormField>
              )}

              <FormField>
                <FormLabel>Timezone</FormLabel>
                <Select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Asia/Shanghai">Asia/Shanghai (CST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                </Select>
                <p className="text-xs text-foreground-muted mt-1">
                  Schedule will run according to this timezone
                </p>
              </FormField>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-green-900 mb-1">Preview</h4>
                    <p className="text-sm text-green-800">
                      This trigger will run: <strong>{CRON_PRESETS.find(p => p.value === cronPreset)?.label || 'Custom schedule'}</strong> in <strong>{timezone}</strong> timezone
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 2 && selectedType === 'dependency' && (
            <div className="space-y-6">
              <FormField>
                <FormLabel required>Trigger Name</FormLabel>
                <Input
                  value={triggerName}
                  onChange={(e) => setTriggerName(e.target.value)}
                  placeholder="e.g., After Customer ETL"
                  autoFocus
                />
                {errors.triggerName && <FormError>{errors.triggerName}</FormError>}
              </FormField>

              <FormField>
                <FormLabel required>Upstream Workflow</FormLabel>
                <Select
                  value={upstreamWorkflowId}
                  onChange={(e) => setUpstreamWorkflowId(e.target.value)}
                >
                  <option value="">Select a workflow...</option>
                  {state.workflows
                    .filter(w => w.id !== workflowId) // Exclude current workflow
                    .map(workflow => (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name}
                      </option>
                    ))}
                </Select>
                {state.workflows.length === 0 && (
                  <p className="text-xs text-foreground-muted mt-1">
                    No workflows available. Create workflows first to set up dependencies.
                  </p>
                )}
                {errors.upstream && <FormError>{errors.upstream}</FormError>}
              </FormField>

              <FormField>
                <FormLabel>Trigger Condition</FormLabel>
                <Select
                  value={dependencyCondition}
                  onChange={(e) => setDependencyCondition(e.target.value as DependencyCondition)}
                >
                  <option value="on_success">On Success</option>
                  <option value="on_failure">On Failure</option>
                  <option value="on_completion">On Completion (any status)</option>
                </Select>
                <p className="text-xs text-foreground-muted mt-1">
                  When should this workflow run after the upstream workflow completes?
                </p>
              </FormField>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-semibold text-green-900 mb-1">Preview</h4>
                    <p className="text-sm text-green-800">
                      This workflow will run when{' '}
                      <strong>{state.workflows.find(w => w.id === upstreamWorkflowId)?.name || 'selected workflow'}</strong>{' '}
                      {dependencyCondition === 'on_success' && 'completes successfully'}
                      {dependencyCondition === 'on_failure' && 'fails'}
                      {dependencyCondition === 'on_completion' && 'completes (regardless of status)'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div>
              {step === 2 && (
                <Button variant="outline" onClick={() => setStep(1)} disabled={loading}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              {step === 2 && (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Trigger'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
