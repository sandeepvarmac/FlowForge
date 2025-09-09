"use client"

import * as React from "react"
import { Button, Input } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FormField, FormLabel, FormError, FormDescription, Select, Textarea } from "@/components/ui/form"
import { WorkflowFormData, WorkflowType } from "@/types"
import { useAppContext } from "@/lib/context/app-context"

interface CreateWorkflowModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const workflowTypes: { value: WorkflowType; label: string; description: string }[] = [
  { value: 'manual', label: 'Manual', description: 'Triggered manually by users' },
  { value: 'scheduled', label: 'Scheduled', description: 'Runs on a predefined schedule' },
  { value: 'event-driven', label: 'Event-driven', description: 'Triggered by external events' }
]

const businessUnits = [
  'Finance',
  'Marketing', 
  'Operations',
  'IT',
  'HR',
  'Sales',
  'Legal',
  'Product'
]

const applications = [
  'MDM',
  'Salesforce',
  'SAP',
  'Oracle',
  'ServiceNow',
  'Workday',
  'Custom Application'
]

export function CreateWorkflowModal({ open, onOpenChange }: CreateWorkflowModalProps) {
  const { dispatch } = useAppContext()
  const [loading, setLoading] = React.useState(false)
  const [step, setStep] = React.useState(1)
  const [errors, setErrors] = React.useState<Partial<WorkflowFormData>>({})
  
  const [formData, setFormData] = React.useState<WorkflowFormData>({
    name: '',
    description: '',
    application: '',
    businessUnit: '',
    team: '',
    workflowType: 'manual',
    notificationEmail: '',
    tags: []
  })

  const updateField = (field: keyof WorkflowFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Partial<WorkflowFormData> = {}

    if (stepNumber === 1) {
      if (!formData.name.trim()) newErrors.name = 'Workflow name is required'
      if (!formData.description.trim()) newErrors.description = 'Description is required'
      if (!formData.application) newErrors.application = 'Application is required'
    }

    if (stepNumber === 2) {
      if (!formData.businessUnit) newErrors.businessUnit = 'Business unit is required'
      if (!formData.team.trim()) newErrors.team = 'Team is required'
      if (!formData.workflowType) newErrors.workflowType = 'Workflow type is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleSubmit = async () => {
    if (!validateStep(2)) return

    setLoading(true)
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Create new workflow object
      const newWorkflow = {
        id: Date.now().toString(),
        name: formData.name,
        description: formData.description,
        application: formData.application,
        owner: formData.team,
        status: 'manual' as const,
        type: formData.workflowType,
        lastRun: undefined,
        nextRun: undefined,
        createdAt: new Date(),
        updatedAt: new Date()
      }

      dispatch({ type: 'ADD_WORKFLOW', payload: newWorkflow })
      
      // Reset form and close modal
      setFormData({
        name: '',
        description: '',
        application: '',
        businessUnit: '',
        team: '',
        workflowType: 'manual',
        notificationEmail: '',
        tags: []
      })
      setStep(1)
      setErrors({})
      onOpenChange(false)
    } catch (error) {
      console.error('Failed to create workflow:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(1)
    setErrors({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Workflow</DialogTitle>
          <DialogDescription>
            Set up a new workflow to automate your business processes
          </DialogDescription>
          
          {/* Progress indicator */}
          <div className="flex items-center space-x-2 mt-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step >= 1 ? 'bg-primary text-white' : 'bg-background-tertiary text-foreground-muted'
            }`}>
              1
            </div>
            <div className={`h-0.5 w-12 transition-colors ${
              step >= 2 ? 'bg-primary' : 'bg-background-tertiary'
            }`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step >= 2 ? 'bg-primary text-white' : 'bg-background-tertiary text-foreground-muted'
            }`}>
              2
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6">
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-sm font-medium text-foreground mb-4">
                Workflow Information
              </div>
              
              <FormField>
                <FormLabel htmlFor="name" required>Workflow Name</FormLabel>
                <Input
                  id="name"
                  placeholder="Enter workflow name"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                />
                <FormError>{errors.name}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="description" required>Description</FormLabel>
                <Textarea
                  id="description"
                  placeholder="Enter workflow description"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={3}
                />
                <FormError>{errors.description}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="application" required>Application</FormLabel>
                <Select
                  id="application"
                  value={formData.application}
                  onChange={(e) => updateField('application', e.target.value)}
                >
                  <option value="">Select application</option>
                  {applications.map((app) => (
                    <option key={app} value={app}>{app}</option>
                  ))}
                </Select>
                <FormError>{errors.application}</FormError>
              </FormField>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="text-sm font-medium text-foreground mb-4">
                Business Information
              </div>
              
              <FormField>
                <FormLabel htmlFor="businessUnit" required>Business Unit</FormLabel>
                <Select
                  id="businessUnit"
                  value={formData.businessUnit}
                  onChange={(e) => updateField('businessUnit', e.target.value)}
                >
                  <option value="">Select business unit</option>
                  {businessUnits.map((unit) => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </Select>
                <FormError>{errors.businessUnit}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="team" required>Team</FormLabel>
                <Input
                  id="team"
                  placeholder="Enter team name"
                  value={formData.team}
                  onChange={(e) => updateField('team', e.target.value)}
                />
                <FormError>{errors.team}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="workflowType" required>Workflow Type</FormLabel>
                <Select
                  id="workflowType"
                  value={formData.workflowType}
                  onChange={(e) => updateField('workflowType', e.target.value as WorkflowType)}
                >
                  {workflowTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </Select>
                <FormDescription>
                  {workflowTypes.find(t => t.value === formData.workflowType)?.description}
                </FormDescription>
                <FormError>{errors.workflowType}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="notificationEmail">Notification Email</FormLabel>
                <Input
                  id="notificationEmail"
                  type="email"
                  placeholder="Enter notification email"
                  value={formData.notificationEmail}
                  onChange={(e) => updateField('notificationEmail', e.target.value)}
                />
                <FormDescription>
                  Optional: Email address for workflow notifications
                </FormDescription>
              </FormField>
            </div>
          )}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div>
              {step > 1 && (
                <Button variant="outline" onClick={handleBack} disabled={loading}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              {step < 2 ? (
                <Button onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating...' : 'Create Workflow'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}