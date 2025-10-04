"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button, Input, Badge } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FormField, FormLabel, FormError, Textarea, Select } from "@/components/ui/form"
import { WorkflowFormData } from "@/types"
import { useWorkflowActions } from "@/hooks"
import { Info, X } from "lucide-react"

interface CreateWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateWorkflowModal({ open, onOpenChange }: CreateWorkflowModalProps) {
  const router = useRouter()
  const { createWorkflow } = useWorkflowActions()
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<WorkflowFormData>>({})
  const [tagInput, setTagInput] = React.useState('')

  const [formData, setFormData] = React.useState<WorkflowFormData>({
    name: '',
    description: '',
    application: 'Flat Files',
    businessUnit: 'Data Engineering',
    team: 'Data Engineering Team',
    workflowType: 'manual',
    environment: 'dev',
    dataClassification: 'internal',
    priority: 'medium',
    notificationEmail: '',
    tags: ['csv'],
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
    if (!formData.application) newErrors.application = 'Source application is required'
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

      // Reset form and close
      setFormData({
        name: '',
        description: '',
        application: 'Flat Files',
        businessUnit: 'Data Engineering',
        team: 'Data Engineering Team',
        workflowType: 'manual',
        environment: 'dev',
        dataClassification: 'internal',
        priority: 'medium',
        notificationEmail: '',
        tags: ['csv'],
        retentionDays: 90
      })
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
      <DialogContent size="2xl" className="max-h-[90vh] overflow-hidden flex flex-col">
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

          {/* Source & Ownership */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Source & Ownership</h3>

            <FormField>
              <FormLabel htmlFor="application" required>Source Application</FormLabel>
              <Select
                id="application"
                value={formData.application}
                onChange={(e) => updateField('application', e.target.value)}
              >
                <option value="Flat Files">Flat Files (CSV, Excel, JSON)</option>
                <option value="SAP">SAP ERP</option>
                <option value="Salesforce">Salesforce CRM</option>
                <option value="Oracle">Oracle Database</option>
                <option value="SQL Server">Microsoft SQL Server</option>
                <option value="PostgreSQL">PostgreSQL</option>
                <option value="Snowflake">Snowflake Data Warehouse</option>
                <option value="REST API">REST API Endpoint</option>
                <option value="SFTP">SFTP Server</option>
                <option value="AWS S3">AWS S3 Bucket</option>
                <option value="Azure Blob">Azure Blob Storage</option>
                <option value="Google Cloud">Google Cloud Storage</option>
              </Select>
              <FormError>{errors.application}</FormError>
            </FormField>

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

          {/* Workflow Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Workflow Configuration</h3>

            <FormField>
              <FormLabel htmlFor="workflowType" required>Workflow Trigger</FormLabel>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('workflowType', 'manual')}
                  className={`p-4 border rounded-lg text-left transition-all ${
                    formData.workflowType === 'manual'
                      ? 'border-primary bg-primary-50 shadow-sm'
                      : 'border-border bg-background hover:border-primary-200'
                  }`}
                >
                  <div className="font-medium text-sm">Manual</div>
                  <div className="text-xs text-foreground-muted mt-1">Trigger on demand</div>
                </button>
                <button
                  type="button"
                  disabled
                  className="p-4 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50"
                >
                  <div className="font-medium text-sm">Scheduled</div>
                  <div className="text-xs text-foreground-muted mt-1">Coming soon</div>
                </button>
                <button
                  type="button"
                  disabled
                  className="p-4 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50"
                >
                  <div className="font-medium text-sm">Event-driven</div>
                  <div className="text-xs text-foreground-muted mt-1">Coming soon</div>
                </button>
              </div>
            </FormField>

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
