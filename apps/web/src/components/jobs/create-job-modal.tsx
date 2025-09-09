'use client'

import * as React from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CreateJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onJobCreate: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => void
}

interface JobFormData {
  name: string
  description: string
  type: JobType
  order: number
  sourceConfig: Partial<DataSourceConfig>
  destinationConfig: Partial<DestinationConfig>
  transformationConfig?: Partial<TransformationConfig>
  validationConfig?: Partial<ValidationConfig>
}

const initialFormData: JobFormData = {
  name: '',
  description: '',
  type: 'file-based',
  order: 1,
  sourceConfig: {
    name: '',
    type: 'csv',
    connection: {},
    fileConfig: {
      filePath: '',
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      skipRows: 0,
      compressionType: 'none'
    }
  },
  destinationConfig: {
    bronzeConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet'
    }
  }
}

const steps = [
  { id: 1, title: 'Job Information', description: 'Basic job details and type', icon: FileText },
  { id: 2, title: 'Data Source', description: 'Configure data source connection', icon: Database },
  { id: 3, title: 'File/Query Config', description: 'Source-specific configuration', icon: Upload },
  { id: 4, title: 'Destination Layers', description: 'Bronze, Silver, Gold setup', icon: Settings },
  { id: 5, title: 'Transformations', description: 'Data mapping and transforms', icon: ArrowRight },
  { id: 6, title: 'Validation Rules', description: 'Quality and reconciliation', icon: Shield }
]

export function CreateJobModal({ open, onOpenChange, workflowId, onJobCreate }: CreateJobModalProps) {
  const [currentStep, setCurrentStep] = React.useState(1)
  const [formData, setFormData] = React.useState<JobFormData>(initialFormData)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentStep(1)
    setErrors({})
  }

  const updateFormData = (updates: Partial<JobFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const updateSourceConfig = (updates: Partial<DataSourceConfig>) => {
    setFormData(prev => ({
      ...prev,
      sourceConfig: { ...prev.sourceConfig, ...updates }
    }))
  }

  const updateDestinationConfig = (updates: Partial<DestinationConfig>) => {
    setFormData(prev => ({
      ...prev,
      destinationConfig: { ...prev.destinationConfig, ...updates }
    }))
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.name.trim()) newErrors.name = 'Job name is required'
        if (!formData.description.trim()) newErrors.description = 'Description is required'
        break
      case 2:
        if (!formData.sourceConfig.name?.trim()) newErrors.sourceName = 'Source name is required'
        break
      case 4:
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) {
          newErrors.bronzeTable = 'Bronze table name is required'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = () => {
    if (!validateStep(currentStep)) return

    const job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'> = {
      workflowId,
      name: formData.name,
      description: formData.description,
      type: formData.type,
      order: formData.order,
      sourceConfig: formData.sourceConfig as DataSourceConfig,
      destinationConfig: formData.destinationConfig as DestinationConfig,
      transformationConfig: formData.transformationConfig as TransformationConfig,
      validationConfig: formData.validationConfig as ValidationConfig,
      status: 'configured'
    }

    onJobCreate(job)
    onOpenChange(false)
    resetForm()
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <FormField>
              <FormLabel>Job Name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="e.g., Daily NAV Import"
              />
              {errors.name && <FormError>{errors.name}</FormError>}
            </FormField>

            <FormField>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Describe what this job does..."
                rows={3}
              />
              {errors.description && <FormError>{errors.description}</FormError>}
            </FormField>

            <FormField>
              <FormLabel>Job Type</FormLabel>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'file-based', label: 'File-based', icon: FileText, desc: 'CSV, Excel, JSON files' },
                  { value: 'database', label: 'Database', icon: Database, desc: 'SQL queries, tables' },
                  { value: 'api', label: 'API', icon: Cloud, desc: 'REST API endpoints' }
                ].map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => updateFormData({ type: type.value as JobType })}
                    className={cn(
                      'p-4 border rounded-lg text-left transition-all hover:shadow-md',
                      formData.type === type.value
                        ? 'border-primary bg-primary-50 shadow-md'
                        : 'border-border hover:border-primary-200'
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <type.icon className="w-4 h-4" />
                      <span className="font-medium">{type.label}</span>
                    </div>
                    <p className="text-sm text-foreground-muted">{type.desc}</p>
                  </button>
                ))}
              </div>
            </FormField>

            <FormField>
              <FormLabel>Execution Order</FormLabel>
              <Input
                type="number"
                value={formData.order}
                onChange={(e) => updateFormData({ order: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </FormField>
          </div>
        )

      case 2:
        return (
          <div className="space-y-4">
            <FormField>
              <FormLabel>Data Source Name</FormLabel>
              <Input
                value={formData.sourceConfig.name || ''}
                onChange={(e) => updateSourceConfig({ name: e.target.value })}
                placeholder="e.g., Production Database"
              />
              {errors.sourceName && <FormError>{errors.sourceName}</FormError>}
            </FormField>

            <FormField>
              <FormLabel>Source Type</FormLabel>
              <Select
                value={formData.sourceConfig.type || 'csv'}
                onChange={(e) => updateSourceConfig({ type: e.target.value as DataSourceType })}
              >
                {formData.type === 'file-based' && (
                  <>
                    <option value="csv">CSV File</option>
                    <option value="excel">Excel File</option>
                    <option value="json">JSON File</option>
                  </>
                )}
                {formData.type === 'database' && (
                  <>
                    <option value="sql-server">SQL Server</option>
                    <option value="postgresql">PostgreSQL</option>
                    <option value="oracle">Oracle</option>
                    <option value="snowflake">Snowflake</option>
                  </>
                )}
                {formData.type === 'api' && (
                  <option value="api">REST API</option>
                )}
              </Select>
            </FormField>

            {formData.type === 'database' && (
              <>
                <FormField>
                  <FormLabel>Host</FormLabel>
                  <Input
                    value={formData.sourceConfig.connection?.host || ''}
                    onChange={(e) => updateSourceConfig({
                      connection: { ...formData.sourceConfig.connection, host: e.target.value }
                    })}
                    placeholder="database.company.com"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Port</FormLabel>
                    <Input
                      type="number"
                      value={formData.sourceConfig.connection?.port || ''}
                      onChange={(e) => updateSourceConfig({
                        connection: { ...formData.sourceConfig.connection, port: parseInt(e.target.value) }
                      })}
                      placeholder="1433"
                    />
                  </FormField>

                  <FormField>
                    <FormLabel>Database</FormLabel>
                    <Input
                      value={formData.sourceConfig.connection?.database || ''}
                      onChange={(e) => updateSourceConfig({
                        connection: { ...formData.sourceConfig.connection, database: e.target.value }
                      })}
                      placeholder="ProductionDB"
                    />
                  </FormField>
                </div>

                <FormField>
                  <FormLabel>Username</FormLabel>
                  <Input
                    value={formData.sourceConfig.connection?.username || ''}
                    onChange={(e) => updateSourceConfig({
                      connection: { ...formData.sourceConfig.connection, username: e.target.value }
                    })}
                    placeholder="service_account"
                  />
                </FormField>
              </>
            )}
          </div>
        )

      case 3:
        return (
          <div className="space-y-4">
            {formData.type === 'file-based' && (
              <>
                <FormField>
                  <FormLabel>File Path</FormLabel>
                  <Input
                    value={formData.sourceConfig.fileConfig?.filePath || ''}
                    onChange={(e) => updateSourceConfig({
                      fileConfig: { ...formData.sourceConfig.fileConfig!, filePath: e.target.value }
                    })}
                    placeholder="/data/input/files"
                  />
                </FormField>

                <FormField>
                  <FormLabel>File Pattern</FormLabel>
                  <Input
                    value={formData.sourceConfig.fileConfig?.filePattern || ''}
                    onChange={(e) => updateSourceConfig({
                      fileConfig: { ...formData.sourceConfig.fileConfig!, filePattern: e.target.value }
                    })}
                    placeholder="data_*.csv"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Delimiter</FormLabel>
                    <Select
                      value={formData.sourceConfig.fileConfig?.delimiter || ','}
                      onChange={(e) => updateSourceConfig({
                        fileConfig: { ...formData.sourceConfig.fileConfig!, delimiter: e.target.value }
                      })}
                    >
                      <option value=",">Comma (,)</option>
                      <option value="|">Pipe (|)</option>
                      <option value="\t">Tab</option>
                      <option value=";">Semicolon (;)</option>
                    </Select>
                  </FormField>

                  <FormField>
                    <FormLabel>Encoding</FormLabel>
                    <Select
                      value={formData.sourceConfig.fileConfig?.encoding || 'utf-8'}
                      onChange={(e) => updateSourceConfig({
                        fileConfig: { ...formData.sourceConfig.fileConfig!, encoding: e.target.value }
                      })}
                    >
                      <option value="utf-8">UTF-8</option>
                      <option value="utf-16">UTF-16</option>
                      <option value="iso-8859-1">ISO-8859-1</option>
                    </Select>
                  </FormField>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.sourceConfig.fileConfig?.hasHeader ?? true}
                      onChange={(e) => updateSourceConfig({
                        fileConfig: { ...formData.sourceConfig.fileConfig!, hasHeader: e.target.checked }
                      })}
                    />
                    Has header row
                  </label>
                </div>
              </>
            )}

            {formData.type === 'database' && (
              <>
                <FormField>
                  <FormLabel>Query Type</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => updateSourceConfig({
                        databaseConfig: { ...formData.sourceConfig.databaseConfig, tableName: '', query: 'SELECT * FROM table_name', storedProcedure: '', isIncremental: false }
                      })}
                      className={cn(
                        'p-3 border rounded-lg text-left',
                        formData.sourceConfig.databaseConfig?.query ? 'border-primary bg-primary-50' : 'border-border'
                      )}
                    >
                      <div className="font-medium">Custom Query</div>
                      <div className="text-sm text-foreground-muted">Write SQL query</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSourceConfig({
                        databaseConfig: { ...formData.sourceConfig.databaseConfig, tableName: 'table_name', query: '', storedProcedure: '', isIncremental: false }
                      })}
                      className={cn(
                        'p-3 border rounded-lg text-left',
                        formData.sourceConfig.databaseConfig?.tableName ? 'border-primary bg-primary-50' : 'border-border'
                      )}
                    >
                      <div className="font-medium">Table Name</div>
                      <div className="text-sm text-foreground-muted">Select from table</div>
                    </button>
                  </div>
                </FormField>

                {formData.sourceConfig.databaseConfig?.query && (
                  <FormField>
                    <FormLabel>SQL Query</FormLabel>
                    <Textarea
                      value={formData.sourceConfig.databaseConfig.query}
                      onChange={(e) => updateSourceConfig({
                        databaseConfig: { ...formData.sourceConfig.databaseConfig!, query: e.target.value }
                      })}
                      placeholder="SELECT * FROM table_name WHERE created_date > ?"
                      rows={4}
                    />
                  </FormField>
                )}

                {formData.sourceConfig.databaseConfig?.tableName && (
                  <FormField>
                    <FormLabel>Table Name</FormLabel>
                    <Input
                      value={formData.sourceConfig.databaseConfig.tableName}
                      onChange={(e) => updateSourceConfig({
                        databaseConfig: { ...formData.sourceConfig.databaseConfig!, tableName: e.target.value }
                      })}
                      placeholder="customer_data"
                    />
                  </FormField>
                )}
              </>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-4">
            <div className="text-sm text-foreground-muted mb-4">
              Configure the Bronze, Silver, and Gold data layers for your job.
            </div>

            {/* Bronze Layer */}
            <Card className="border-amber-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  Bronze Layer (Raw Data)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField>
                  <FormLabel>Table Name</FormLabel>
                  <Input
                    value={formData.destinationConfig.bronzeConfig?.tableName || ''}
                    onChange={(e) => updateDestinationConfig({
                      bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, tableName: e.target.value }
                    })}
                    placeholder="bronze_raw_data"
                  />
                  {errors.bronzeTable && <FormError>{errors.bronzeTable}</FormError>}
                </FormField>
              </CardContent>
            </Card>

            {/* Silver Layer */}
            <Card className="border-gray-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.destinationConfig.silverConfig?.enabled ?? false}
                    onChange={(e) => updateDestinationConfig({
                      silverConfig: e.target.checked ? {
                        enabled: true,
                        tableName: '',
                        storageFormat: 'parquet'
                      } : undefined
                    })}
                  />
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  Silver Layer (Cleaned Data)
                </CardTitle>
              </CardHeader>
              {formData.destinationConfig.silverConfig?.enabled && (
                <CardContent>
                  <FormField>
                    <FormLabel>Table Name</FormLabel>
                    <Input
                      value={formData.destinationConfig.silverConfig?.tableName || ''}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, tableName: e.target.value }
                      })}
                      placeholder="silver_cleaned_data"
                    />
                  </FormField>
                </CardContent>
              )}
            </Card>

            {/* Gold Layer */}
            <Card className="border-yellow-300">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formData.destinationConfig.goldConfig?.enabled ?? false}
                    onChange={(e) => updateDestinationConfig({
                      goldConfig: e.target.checked ? {
                        enabled: true,
                        tableName: '',
                        storageFormat: 'iceberg'
                      } : undefined
                    })}
                  />
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  Gold Layer (Reporting Data)
                </CardTitle>
              </CardHeader>
              {formData.destinationConfig.goldConfig?.enabled && (
                <CardContent>
                  <FormField>
                    <FormLabel>Table Name</FormLabel>
                    <Input
                      value={formData.destinationConfig.goldConfig?.tableName || ''}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, tableName: e.target.value }
                      })}
                      placeholder="gold_reporting_data"
                    />
                  </FormField>
                </CardContent>
              )}
            </Card>
          </div>
        )

      case 5:
        return (
          <div className="space-y-4">
            <div className="text-center py-8 text-foreground-muted">
              <ArrowRight className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Transformation configuration</p>
              <p className="text-sm">Column mapping and data transforms will be available soon</p>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-4">
            <div className="text-center py-8 text-foreground-muted">
              <Shield className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p>Validation rule configuration</p>
              <p className="text-sm">Data quality and reconciliation rules will be available soon</p>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
        </DialogHeader>

        {/* Step Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  currentStep === step.id
                    ? 'bg-primary text-white'
                    : currentStep > step.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                )}>
                  {currentStep > step.id ? (
                    <CheckCircle className="w-4 h-4" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'w-16 h-0.5 mx-2',
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-200'
                  )} />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h3 className="font-semibold">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-foreground-muted">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {currentStep < 6 ? (
              <Button onClick={nextStep}>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button onClick={handleSubmit}>
                Create Job
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}