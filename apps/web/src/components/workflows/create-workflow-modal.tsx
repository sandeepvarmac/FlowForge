"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Badge } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FormField, FormLabel, FormError, Textarea, Select } from "@/components/ui/form"
import { WorkflowFormData } from "@/types"
import { useWorkflowActions } from "@/hooks"
import { Info, X, Clock, GitBranch, Zap } from "lucide-react"
import { TriggersService } from "@/lib/services/triggers-service"
import { useAppContext } from "@/lib/context/app-context"
import type { TriggerType, DependencyCondition } from "@/types/trigger"

interface CreateWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Cron presets for scheduled triggers
const CRON_PRESETS = [
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at 2 AM', value: '0 2 * * *' },
  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
  { label: 'Every weekday at 9 AM', value: '0 9 * * 1-5' },
  { label: 'Custom', value: 'custom' }
]

export function CreateWorkflowModal({ open, onOpenChange }: CreateWorkflowModalProps) {
  const router = useRouter()
  const { state } = useAppContext()
  const { createWorkflow } = useWorkflowActions()
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<WorkflowFormData>>({})
  const [tagInput, setTagInput] = React.useState('')

  // Initial trigger configuration
  const [initialTriggerType, setInitialTriggerType] = React.useState<'scheduled' | 'dependency' | 'event' | null>(null)
  const [triggerName, setTriggerName] = React.useState('')

  // Scheduled trigger config
  const [cronPreset, setCronPreset] = React.useState('0 2 * * *') // Daily at 2 AM default
  const [customCron, setCustomCron] = React.useState('')
  const [timezone, setTimezone] = React.useState('UTC')

  // Dependency trigger config
  const [upstreamWorkflowId, setUpstreamWorkflowId] = React.useState('')
  const [dependencyCondition, setDependencyCondition] = React.useState<DependencyCondition>('on_success')

  const [formData, setFormData] = React.useState<WorkflowFormData>({
    name: '',
    description: '',
    application: '',
    businessUnit: 'Data Engineering',
    team: 'Data Engineering Team',
    workflowType: 'manual',
    environment: 'dev',
    dataClassification: 'internal',
    priority: 'medium',
    notificationEmail: '',
    tags: [],
    retentionDays: 90
  })

  const updateField = (field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<WorkflowFormData> = {}

    if (!formData.name.trim()) newErrors.name = 'Workflow name is required'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (!formData.team) newErrors.team = 'Team is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      updateField('tags', [...(formData.tags || []), tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    updateField('tags', formData.tags?.filter(t => t !== tag) || [])
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      const newWorkflow = await createWorkflow(formData)

      // Create initial trigger if configured
      if (newWorkflow?.id && initialTriggerType !== null) {
        try {
          if (initialTriggerType === 'scheduled') {
            const cronExpression = cronPreset === 'custom' ? customCron : cronPreset
            await TriggersService.createTrigger(newWorkflow.id, {
              triggerName: triggerName || `Scheduled - ${CRON_PRESETS.find(p => p.value === cronPreset)?.label || 'Custom'}`,
              triggerType: 'scheduled' as TriggerType,
              enabled: true,
              cronExpression: cronExpression,
              timezone: timezone
            })
          } else if (initialTriggerType === 'dependency') {
            if (upstreamWorkflowId) {
              const upstreamWorkflow = state.workflows.find(w => w.id === upstreamWorkflowId)
              await TriggersService.createTrigger(newWorkflow.id, {
                triggerName: triggerName || `Dependency - ${upstreamWorkflow?.name || 'Upstream Workflow'}`,
                triggerType: 'dependency' as TriggerType,
                enabled: true,
                dependsOnWorkflowId: upstreamWorkflowId,
                dependencyCondition: dependencyCondition
              })
            }
          }
        } catch (triggerError) {
          console.error('Failed to create initial trigger:', triggerError)
          // Don't fail the whole workflow creation if trigger fails
        }
      }

      // Reset form and close
      setFormData({
        name: '',
        description: '',
        application: '',
        businessUnit: 'Data Engineering',
        team: 'Data Engineering Team',
        workflowType: 'manual',
        environment: 'dev',
        dataClassification: 'internal',
        priority: 'medium',
        notificationEmail: '',
        tags: [],
        retentionDays: 90
      })
      setInitialTriggerType(null)
      setTriggerName('')
      setCronPreset('0 2 * * *')
      setCustomCron('')
      setTimezone('UTC')
      setUpstreamWorkflowId('')
      setDependencyCondition('on_success')
      setErrors({})
      setTagInput('')
      onOpenChange(false)

      // Auto-navigate to workflow detail page
      if (newWorkflow?.id) {
        router.push(`/workflows/${newWorkflow.id}`)
      }
    } catch (error) {
      console.error('Failed to create workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>
            Configure a new data processing workflow for your enterprise data platform
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

            <FormField>
              <FormLabel htmlFor="name" required>Workflow Name</FormLabel>
              <Input
                id="name"
                placeholder="e.g., Customer Data Pipeline"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                autoFocus
              />
              <FormError>{errors.name}</FormError>
            </FormField>

            <FormField>
              <FormLabel htmlFor="description" required>Description</FormLabel>
              <Textarea
                id="description"
                placeholder="e.g., Daily import of customer data from CSV files for downstream analytics"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
              />
              <FormError>{errors.description}</FormError>
            </FormField>
          </div>

          {/* Ownership */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Ownership</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel htmlFor="businessUnit">Business Unit</FormLabel>
                <Select
                  id="businessUnit"
                  value={formData.businessUnit}
                  onChange={(e) => updateField('businessUnit', e.target.value)}
                >
                  <option value="Data Engineering">Data Engineering</option>
                  <option value="Finance">Finance</option>
                  <option value="Sales">Sales</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operations">Operations</option>
                  <option value="Supply Chain">Supply Chain</option>
                  <option value="Human Resources">Human Resources</option>
                  <option value="IT">Information Technology</option>
                  <option value="Customer Service">Customer Service</option>
                  <option value="Analytics">Analytics & Insights</option>
                </Select>
              </FormField>

              <FormField>
                <FormLabel htmlFor="team" required>Owning Team</FormLabel>
                <Select
                  id="team"
                  value={formData.team}
                  onChange={(e) => updateField('team', e.target.value)}
                >
                  <option value="Data Engineering Team">Data Engineering Team</option>
                  <option value="Analytics Team">Analytics Team</option>
                  <option value="Finance Data Team">Finance Data Team</option>
                  <option value="Sales Operations">Sales Operations</option>
                  <option value="Marketing Analytics">Marketing Analytics</option>
                  <option value="BI Team">Business Intelligence Team</option>
                  <option value="Data Science">Data Science Team</option>
                  <option value="ETL Team">ETL Development Team</option>
                </Select>
                <FormError>{errors.team}</FormError>
              </FormField>
            </div>
          </div>

          {/* Initial Trigger Configuration */}
          <div className="space-y-4">
            <div className="border-b pb-2">
              <h3 className="text-sm font-semibold text-foreground">Initial Trigger (Optional)</h3>
              <p className="text-xs text-foreground-muted mt-1">
                Configure an initial trigger now, or add triggers later from the workflow detail page. Manual execution is always available.
              </p>
            </div>

            <div className="flex gap-3">
              {/* Scheduled Trigger */}
              <button
                type="button"
                onClick={() => setInitialTriggerType(initialTriggerType === 'scheduled' ? null : 'scheduled')}
                className={`flex-1 p-3 border rounded-lg text-left transition-all ${
                  initialTriggerType === 'scheduled'
                    ? 'border-primary bg-primary-50 shadow-sm ring-2 ring-primary ring-opacity-50'
                    : 'border-border bg-background hover:border-primary-200 hover:bg-primary-50/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Clock className={`w-4 h-4 ${initialTriggerType === 'scheduled' ? 'text-primary' : ''}`} />
                  <span className="font-medium text-sm">Scheduled</span>
                </div>
                <div className="text-xs text-foreground-muted">Run on a schedule</div>
              </button>

              {/* Dependency Trigger */}
              <button
                type="button"
                onClick={() => setInitialTriggerType(initialTriggerType === 'dependency' ? null : 'dependency')}
                className={`flex-1 p-3 border rounded-lg text-left transition-all ${
                  initialTriggerType === 'dependency'
                    ? 'border-primary bg-primary-50 shadow-sm ring-2 ring-primary ring-opacity-50'
                    : 'border-border bg-background hover:border-primary-200 hover:bg-primary-50/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <GitBranch className={`w-4 h-4 ${initialTriggerType === 'dependency' ? 'text-primary' : ''}`} />
                  <span className="font-medium text-sm">Dependency</span>
                </div>
                <div className="text-xs text-foreground-muted">After another workflow</div>
              </button>

              {/* Event-driven Trigger */}
              <button
                type="button"
                disabled
                className="flex-1 p-3 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <Zap className="w-4 h-4" />
                  <span className="font-medium text-sm">Event-driven</span>
                </div>
                <div className="text-xs text-foreground-muted">Coming soon</div>
              </button>
            </div>

            {/* Inline Configuration for Scheduled Trigger */}
            {initialTriggerType === 'scheduled' && (
              <div className="bg-primary-50/30 border border-primary-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-foreground">Configure Schedule</h4>

                <FormField>
                  <FormLabel htmlFor="triggerName">Trigger Name (Optional)</FormLabel>
                  <Input
                    id="triggerName"
                    placeholder="e.g., Daily Import at 2 AM"
                    value={triggerName}
                    onChange={(e) => setTriggerName(e.target.value)}
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="cronPreset">Schedule</FormLabel>
                  <Select
                    id="cronPreset"
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
                    <FormLabel htmlFor="customCron">Custom Cron Expression</FormLabel>
                    <Input
                      id="customCron"
                      placeholder="0 2 * * *"
                      value={customCron}
                      onChange={(e) => setCustomCron(e.target.value)}
                    />
                    <p className="text-xs text-foreground-muted mt-1">
                      Format: minute hour day month weekday
                    </p>
                  </FormField>
                )}

                <FormField>
                  <FormLabel htmlFor="timezone">Timezone</FormLabel>
                  <Select
                    id="timezone"
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
                </FormField>
              </div>
            )}

            {/* Inline Configuration for Dependency Trigger */}
            {initialTriggerType === 'dependency' && (
              <div className="bg-primary-50/30 border border-primary-200 rounded-lg p-4 space-y-3">
                <h4 className="text-sm font-medium text-foreground">Configure Dependency</h4>

                <FormField>
                  <FormLabel htmlFor="triggerName">Trigger Name (Optional)</FormLabel>
                  <Input
                    id="triggerName"
                    placeholder="e.g., After Customer ETL"
                    value={triggerName}
                    onChange={(e) => setTriggerName(e.target.value)}
                  />
                </FormField>

                <FormField>
                  <FormLabel htmlFor="upstreamWorkflow" required>Upstream Workflow</FormLabel>
                  <Select
                    id="upstreamWorkflow"
                    value={upstreamWorkflowId}
                    onChange={(e) => setUpstreamWorkflowId(e.target.value)}
                  >
                    <option value="">Select a workflow...</option>
                    {state.workflows
                      .filter(w => w.id !== formData.name) // Exclude current workflow (if exists)
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
                </FormField>

                <FormField>
                  <FormLabel htmlFor="dependencyCondition">Trigger Condition</FormLabel>
                  <Select
                    id="dependencyCondition"
                    value={dependencyCondition}
                    onChange={(e) => setDependencyCondition(e.target.value as DependencyCondition)}
                  >
                    <option value="on_success">On Success</option>
                    <option value="on_failure">On Failure</option>
                    <option value="always">Always</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    When should this workflow run after the upstream workflow completes?
                  </p>
                </FormField>
              </div>
            )}
          </div>

          {/* Workflow Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Workflow Configuration</h3>

            <div className="grid grid-cols-3 gap-4">
              <FormField>
                <FormLabel htmlFor="environment">Environment</FormLabel>
                <Select
                  id="environment"
                  value={formData.environment || 'dev'}
                  onChange={(e) => updateField('environment', e.target.value)}
                >
                  <option value="dev">Development</option>
                  <option value="qa">QA/Testing</option>
                  <option value="prod">Production</option>
                </Select>
              </FormField>

              <FormField>
                <FormLabel htmlFor="dataClassification">Data Classification</FormLabel>
                <Select
                  id="dataClassification"
                  value={formData.dataClassification || 'internal'}
                  onChange={(e) => updateField('dataClassification', e.target.value)}
                >
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                  <option value="confidential">Confidential</option>
                  <option value="pii">PII/Sensitive</option>
                </Select>
              </FormField>

              <FormField>
                <FormLabel htmlFor="priority">Priority/SLA</FormLabel>
                <Select
                  id="priority"
                  value={formData.priority || 'medium'}
                  onChange={(e) => updateField('priority', e.target.value)}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </FormField>
            </div>
          </div>

          {/* Additional Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Additional Settings</h3>

            <FormField>
              <FormLabel htmlFor="notificationEmail">
                Notification Email(s)
                <span className="text-xs text-foreground-muted ml-2">(Optional, comma-separated)</span>
              </FormLabel>
              <Input
                id="notificationEmail"
                type="email"
                placeholder="e.g., data-team@company.com, alerts@company.com"
                value={formData.notificationEmail || ''}
                onChange={(e) => updateField('notificationEmail', e.target.value)}
              />
              <p className="text-xs text-foreground-muted mt-1">
                <Info className="w-3 h-3 inline mr-1" />
                Receive alerts for job failures and completion notifications
              </p>
            </FormField>

            <FormField>
              <FormLabel htmlFor="tags">
                Tags
                <span className="text-xs text-foreground-muted ml-2">(Optional, for categorization)</span>
              </FormLabel>
              <div className="flex gap-2">
                <Input
                  id="tags"
                  placeholder="Add tag..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  Add
                </Button>
              </div>
              {formData.tags && formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                      {tag}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </FormField>

            <FormField>
              <FormLabel htmlFor="retentionDays">Data Retention (Days)</FormLabel>
              <Select
                id="retentionDays"
                value={String(formData.retentionDays || 90)}
                onChange={(e) => updateField('retentionDays', parseInt(e.target.value))}
              >
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days (Default)</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="730">2 years</option>
              </Select>
              <p className="text-xs text-foreground-muted mt-1">
                How long to keep execution history and logs
              </p>
            </FormField>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Creating...' : 'Create Workflow'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
