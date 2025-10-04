'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield, AlertCircle, Eye, HardDrive, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSVFileUpload } from './csv-file-upload'

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
  // Additional fields for file upload
  _uploadedFile?: File
  _detectedSchema?: Array<{ name: string; type: string; sample?: string }>
  _previewData?: any[]
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
      filePattern: '',
      uploadMode: 'single',
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
      storageFormat: 'parquet',
      loadStrategy: 'append',
      auditColumns: true
    },
    silverConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      surrogateKeyStrategy: 'auto_increment',
      primaryKey: ''
    },
    goldConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }
}

const steps = [
  { id: 1, title: 'Job Type & Configuration', description: 'Select job type and upload data', icon: Upload },
  { id: 2, title: 'Medallion Architecture', description: 'Configure Bronze, Silver, Gold layers', icon: Settings },
  { id: 3, title: 'Review & Create', description: 'Review configuration and create job', icon: CheckCircle }
]

const jobTypes = [
  {
    value: 'file-based',
    label: 'File-based',
    icon: FileText,
    description: 'CSV, Excel, JSON, Parquet files',
    enabled: true,
    badge: null
  },
  {
    value: 'database',
    label: 'Database',
    icon: Database,
    description: 'SQL Server, PostgreSQL, Oracle, MySQL, Snowflake',
    enabled: false,
    badge: 'Coming Soon'
  },
  {
    value: 'nosql',
    label: 'NoSQL / Unstructured',
    icon: HardDrive,
    description: 'MongoDB, Cassandra, DocumentDB, S3, Blob Storage',
    enabled: false,
    badge: 'Coming Soon'
  },
  {
    value: 'api',
    label: 'API',
    icon: Cloud,
    description: 'REST APIs, GraphQL, Webhooks',
    enabled: false,
    badge: 'Coming Soon'
  }
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
        if (!formData._uploadedFile) newErrors.file = 'CSV file upload is required'
        break
      case 2:
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) {
          newErrors.bronzeTable = 'Bronze table name is required'
        }
        if (!formData.destinationConfig.silverConfig?.tableName?.trim()) {
          newErrors.silverTable = 'Silver table name is required'
        }
        if (!formData.destinationConfig.goldConfig?.tableName?.trim()) {
          newErrors.goldTable = 'Gold table name is required'
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 3))
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
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

              <FormField>
                <FormLabel required>Job Name</FormLabel>
                <Input
                  value={formData.name}
                  onChange={(e) => updateFormData({ name: e.target.value })}
                  placeholder="e.g., Customer Data Import"
                  autoFocus
                />
                {errors.name && <FormError>{errors.name}</FormError>}
              </FormField>

              <FormField>
                <FormLabel>Description</FormLabel>
                <Textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Describe what this job does and the data it processes..."
                  rows={2}
                />
              </FormField>

              <FormField>
                <FormLabel>Execution Order</FormLabel>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => updateFormData({ order: parseInt(e.target.value) || 1 })}
                  min={1}
                  className="w-32"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Jobs execute sequentially based on this order (1, 2, 3...)
                </p>
              </FormField>
            </div>

            {/* Job Type Selection */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Data Source Type</h3>

              <div className="grid grid-cols-2 gap-4">
                {jobTypes.map((type) => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => type.enabled && updateFormData({ type: type.value as JobType })}
                      disabled={!type.enabled}
                      className={cn(
                        'p-5 border rounded-lg text-left transition-all relative',
                        formData.type === type.value && type.enabled
                          ? 'border-primary bg-primary-50 shadow-md ring-2 ring-primary ring-opacity-50'
                          : type.enabled
                          ? 'border-border hover:border-primary-200 hover:shadow-sm'
                          : 'border-border bg-gray-50 opacity-60 cursor-not-allowed',
                        'min-h-[120px] flex flex-col justify-between'
                      )}
                    >
                      {type.badge && (
                        <Badge className="absolute top-3 right-3 text-xs" variant="secondary">
                          {type.badge}
                        </Badge>
                      )}

                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className={cn(
                            'w-5 h-5',
                            formData.type === type.value && type.enabled ? 'text-primary' : 'text-foreground-muted'
                          )} />
                          <span className="font-semibold text-foreground">{type.label}</span>
                        </div>
                        <p className="text-sm text-foreground-muted leading-relaxed">
                          {type.description}
                        </p>
                      </div>

                      {formData.type === type.value && type.enabled && (
                        <div className="flex items-center gap-1 text-primary text-sm font-medium mt-2">
                          <CheckCircle className="w-4 h-4" />
                          <span>Selected</span>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* File Upload Section - Only shown for file-based jobs */}
            {formData.type === 'file-based' && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-foreground border-b pb-2 flex items-center gap-2">
                  Upload Data Source
                  {formData._uploadedFile && (
                    <Badge variant="success" className="text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Schema Detected
                    </Badge>
                  )}
                </h3>

                <FormField>
                  <FormLabel>Upload Mode</FormLabel>
                  <Select
                    value={formData.sourceConfig.fileConfig?.uploadMode || 'single'}
                    onChange={(e) => updateSourceConfig({
                      fileConfig: {
                        ...formData.sourceConfig.fileConfig!,
                        uploadMode: e.target.value as any
                      }
                    })}
                  >
                    <option value="single">Single File (Upload one CSV file)</option>
                    <option value="pattern">Pattern Matching (e.g., customer_*.csv)</option>
                    <option value="directory" disabled>Directory (Coming Soon)</option>
                  </Select>
                </FormField>

                {formData.sourceConfig.fileConfig?.uploadMode === 'pattern' && (
                  <FormField>
                    <FormLabel required>File Pattern</FormLabel>
                    <Input
                      value={formData.sourceConfig.fileConfig?.filePattern || ''}
                      onChange={(e) => updateSourceConfig({
                        fileConfig: {
                          ...formData.sourceConfig.fileConfig!,
                          filePattern: e.target.value
                        }
                      })}
                      placeholder="customer_*.csv"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      Example: customer_*.csv will match customer_2024.csv, customer_jan.csv, etc.
                    </div>
                  </FormField>
                )}

                <FormField>
                  <FormLabel required>
                    {formData.sourceConfig.fileConfig?.uploadMode === 'pattern' ? 'Sample CSV File (for schema detection)' : 'CSV File'}
                  </FormLabel>
                  <CSVFileUpload
                    onFileUpload={(file, schema, preview) => {
                      // Auto-generate table names from filename
                      const cleanName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, '_')

                      updateSourceConfig({
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        fileConfig: {
                          ...formData.sourceConfig.fileConfig!,
                          filePath: file.name,
                          filePattern: file.name
                        }
                      })

                      // Auto-populate table names with AI suggestions
                      updateDestinationConfig({
                        bronzeConfig: {
                          ...formData.destinationConfig.bronzeConfig!,
                          tableName: `bronze_${cleanName}`
                        },
                        silverConfig: {
                          ...formData.destinationConfig.silverConfig!,
                          tableName: `silver_${cleanName}`
                        },
                        goldConfig: {
                          ...formData.destinationConfig.goldConfig!,
                          tableName: `gold_${cleanName}`
                        }
                      })

                      setFormData(prev => ({
                        ...prev,
                        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
                        _uploadedFile: file,
                        _detectedSchema: schema,
                        _previewData: preview
                      } as any))
                    }}
                    expectedColumns={['customer_id', 'first_name', 'last_name', 'email', 'phone', 'registration_date', 'status', 'country', 'revenue']}
                    initialFile={formData._uploadedFile}
                    initialSchema={formData._detectedSchema}
                    initialPreview={formData._previewData}
                  />
                  {errors.file && <FormError>{errors.file}</FormError>}
                </FormField>

                {/* AI Schema Intelligence Display */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <Card className="border-blue-200 bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-900">AI-Detected Schema Intelligence</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="text-xl font-bold text-blue-700">{formData._detectedSchema.length}</div>
                          <div className="text-xs text-blue-600 font-medium">Columns Detected</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="text-xl font-bold text-blue-700">{formData._previewData?.length || 0}</div>
                          <div className="text-xs text-blue-600 font-medium">Sample Rows</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="text-xl font-bold text-green-700">
                            {formData._detectedSchema.filter(c => c.type !== 'string').length}
                          </div>
                          <div className="text-xs text-green-600 font-medium">Typed Columns</div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="text-xl font-bold text-purple-700">
                            {formData._detectedSchema.filter(c => ['email', 'phone', 'date'].includes(c.type)).length}
                          </div>
                          <div className="text-xs text-purple-600 font-medium">Special Types</div>
                        </div>
                      </div>
                      <p className="text-xs text-blue-700 mt-3 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Table names have been auto-generated based on your file. You can customize them in the next step.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Medallion Architecture Configuration</h4>
                  <p className="text-sm text-blue-800">
                    Configure how your data flows through Bronze (raw) → Silver (cleaned) → Gold (business-ready) layers.
                    AI-suggested table names are pre-populated and can be customized.
                  </p>
                </div>
              </div>
            </div>

            {/* Bronze Layer - Enhanced */}
            <Card className="border-amber-300 bg-amber-50/30">
              <CardHeader className="pb-3 bg-amber-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Bronze Layer (Raw Data Ingestion)
                  </CardTitle>
                  <Badge variant="success" className="text-xs">Active</Badge>
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Stores raw data exactly as received from source with minimal transformation
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField>
                  <FormLabel required>Table Name</FormLabel>
                  <Input
                    value={formData.destinationConfig.bronzeConfig?.tableName || ''}
                    onChange={(e) => updateDestinationConfig({
                      bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, tableName: e.target.value }
                    })}
                    placeholder="bronze_raw_data"
                  />
                  {errors.bronzeTable && <FormError>{errors.bronzeTable}</FormError>}
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Storage Format</FormLabel>
                    <Select
                      value={formData.destinationConfig.bronzeConfig?.storageFormat || 'parquet'}
                      onChange={(e) => updateDestinationConfig({
                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, storageFormat: e.target.value as any }
                      })}
                    >
                      <option value="parquet">Parquet (Active)</option>
                      <option value="delta" disabled>Delta Lake (Coming Soon)</option>
                      <option value="iceberg" disabled>Apache Iceberg (Coming Soon)</option>
                    </Select>
                    <p className="text-xs text-foreground-muted mt-1">Columnar format optimized for analytics</p>
                  </FormField>

                  <FormField>
                    <FormLabel>Compression</FormLabel>
                    <Select
                      value={formData.destinationConfig.bronzeConfig?.compression || 'snappy'}
                      onChange={(e) => updateDestinationConfig({
                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, compression: e.target.value as any }
                      })}
                    >
                      <option value="snappy">Snappy (Balanced)</option>
                      <option value="gzip">GZIP (High Compression)</option>
                      <option value="zstd">Zstandard (Best)</option>
                      <option value="none">None</option>
                    </Select>
                    <p className="text-xs text-foreground-muted mt-1">Balance between size and speed</p>
                  </FormField>
                </div>

                <FormField>
                  <div className="flex items-center justify-between">
                    <FormLabel>Audit Columns</FormLabel>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.destinationConfig.bronzeConfig?.auditColumns !== false}
                        onChange={(e) => updateDestinationConfig({
                          bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumns: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span className="text-sm text-foreground">Enable</span>
                    </label>
                  </div>
                  <p className="text-xs text-foreground-muted mt-1">
                    Auto-add: _ingested_at, _source_file, _row_number for tracking
                  </p>
                </FormField>
              </CardContent>
            </Card>

            {/* Silver Layer - Enhanced */}
            <Card className="border-gray-300 bg-gray-50/30">
              <CardHeader className="pb-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    Silver Layer (Cleaned & Validated)
                  </CardTitle>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.destinationConfig.silverConfig?.enabled !== false}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, enabled: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-xs font-medium text-foreground">Enable Layer</span>
                  </label>
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Applies data quality rules, type conversions, and standardization
                </p>
              </CardHeader>
              <CardContent className={cn(
                'space-y-4 transition-opacity',
                formData.destinationConfig.silverConfig?.enabled === false && 'opacity-50'
              )}>
                <FormField>
                  <FormLabel required>Table Name</FormLabel>
                  <Input
                    value={formData.destinationConfig.silverConfig?.tableName || ''}
                    onChange={(e) => updateDestinationConfig({
                      silverConfig: { ...formData.destinationConfig.silverConfig!, tableName: e.target.value }
                    })}
                    placeholder="silver_cleaned_data"
                    disabled={formData.destinationConfig.silverConfig?.enabled === false}
                  />
                  {errors.silverTable && <FormError>{errors.silverTable}</FormError>}
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Storage Format</FormLabel>
                    <Select
                      value={formData.destinationConfig.silverConfig?.storageFormat || 'parquet'}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, storageFormat: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.silverConfig?.enabled === false}
                    >
                      <option value="parquet">Parquet (Active)</option>
                      <option value="delta" disabled>Delta Lake (Coming Soon)</option>
                    </Select>
                  </FormField>

                  <FormField>
                    <FormLabel>Merge Strategy</FormLabel>
                    <Select
                      value={formData.destinationConfig.silverConfig?.mergeStrategy || 'merge'}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, mergeStrategy: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.silverConfig?.enabled === false}
                    >
                      <option value="merge">Merge/Upsert (Recommended)</option>
                      <option value="full_refresh">Full Refresh</option>
                      <option value="append">Append Only</option>
                    </Select>
                  </FormField>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Primary Key (for Merge)</FormLabel>
                    <Select
                      value={formData.destinationConfig.silverConfig?.primaryKey || ''}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, primaryKey: e.target.value }
                      })}
                      disabled={formData.destinationConfig.silverConfig?.enabled === false || formData.destinationConfig.silverConfig?.mergeStrategy !== 'merge'}
                    >
                      <option value="">Select primary key...</option>
                      {formData._detectedSchema?.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </Select>
                  </FormField>

                  <FormField>
                    <FormLabel>Surrogate Key Strategy</FormLabel>
                    <Select
                      value={formData.destinationConfig.silverConfig?.surrogateKeyStrategy || 'auto_increment'}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, surrogateKeyStrategy: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.silverConfig?.enabled === false}
                    >
                      <option value="auto_increment">Auto Increment (Recommended)</option>
                      <option value="uuid">UUID</option>
                      <option value="use_existing">Use Existing Column</option>
                    </Select>
                  </FormField>
                </div>

                {/* AI Transformations Preview */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span className="text-sm font-semibold text-purple-900">AI-Suggested Transformations</span>
                      <Badge variant="secondary" className="text-xs ml-auto">Preview Only</Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      {formData._detectedSchema
                        .filter(col => ['email', 'phone', 'date'].includes(col.type))
                        .slice(0, 3)
                        .map((col, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-purple-800">
                            <CheckCircle className="w-3 h-3 text-purple-600" />
                            <code className="font-mono bg-white px-1.5 py-0.5 rounded">{col.name}</code>
                            <span>→</span>
                            <span className="text-purple-700">
                              {col.type === 'email' && 'Validate & lowercase'}
                              {col.type === 'phone' && 'Format: +1-XXX-XXX-XXXX'}
                              {col.type === 'date' && 'Parse to ISO 8601'}
                            </span>
                          </div>
                        ))}
                      {formData._detectedSchema.filter(col => ['email', 'phone', 'date'].includes(col.type)).length === 0 && (
                        <p className="text-purple-700">No special transformations detected for this dataset</p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gold Layer - Enhanced */}
            <Card className="border-yellow-400 bg-yellow-50/30">
              <CardHeader className="pb-3 bg-yellow-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Gold Layer (Business-Ready)
                  </CardTitle>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.destinationConfig.goldConfig?.enabled !== false}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, enabled: e.target.checked }
                      })}
                      className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                    />
                    <span className="text-xs font-medium text-foreground">Enable Layer</span>
                  </label>
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  Optimized for analytics, reporting, and business intelligence
                </p>
              </CardHeader>
              <CardContent className={cn(
                'space-y-4 transition-opacity',
                formData.destinationConfig.goldConfig?.enabled === false && 'opacity-50'
              )}>
                <FormField>
                  <FormLabel required>Table Name</FormLabel>
                  <Input
                    value={formData.destinationConfig.goldConfig?.tableName || ''}
                    onChange={(e) => updateDestinationConfig({
                      goldConfig: { ...formData.destinationConfig.goldConfig!, tableName: e.target.value }
                    })}
                    placeholder="gold_reporting_data"
                    disabled={formData.destinationConfig.goldConfig?.enabled === false}
                  />
                  {errors.goldTable && <FormError>{errors.goldTable}</FormError>}
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Storage Format</FormLabel>
                    <Select
                      value={formData.destinationConfig.goldConfig?.storageFormat || 'iceberg'}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, storageFormat: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.goldConfig?.enabled === false}
                    >
                      <option value="parquet">Parquet (Active)</option>
                      <option value="iceberg" disabled>Apache Iceberg (Coming Soon)</option>
                      <option value="delta" disabled>Delta Lake (Coming Soon)</option>
                    </Select>
                  </FormField>

                  <FormField>
                    <FormLabel>Optimization</FormLabel>
                    <Select disabled>
                      <option value="none">None (Coming Soon)</option>
                      <option value="z-order" disabled>Z-Order (Coming Soon)</option>
                      <option value="cluster" disabled>Clustering (Coming Soon)</option>
                    </Select>
                  </FormField>
                </div>

                {/* AI Aggregations Preview */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-900">AI-Suggested Aggregations</span>
                      <Badge variant="secondary" className="text-xs ml-auto">Preview Only</Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      {formData._detectedSchema
                        .filter(col => col.type === 'number' || col.type === 'integer')
                        .slice(0, 2)
                        .map((col, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-green-800">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <code className="font-mono bg-white px-1.5 py-0.5 rounded">{col.name}</code>
                            <span>→</span>
                            <span className="text-green-700">SUM, AVG, MIN, MAX by date/category</span>
                          </div>
                        ))}
                      {formData._detectedSchema.filter(col => col.type === 'number' || col.type === 'integer').length === 0 && (
                        <p className="text-green-700">No numeric columns detected for aggregation</p>
                      )}
                      <div className="flex items-center gap-2 text-green-800 pt-1 border-t border-green-200">
                        <AlertCircle className="w-3 h-3 text-green-600" />
                        <span className="text-green-700">Full aggregation config available in advanced mode</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-2">
              Review Configuration
            </div>
            <div className="text-sm text-foreground-muted mb-4">
              Review your job configuration before creating
            </div>

            {/* Summary Cards */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Job Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Name:</span>
                    <span className="font-medium">{formData.name || 'Not specified'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Type:</span>
                    <span className="font-medium capitalize">{formData.type.replace('-', ' ')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Execution Order:</span>
                    <span className="font-medium">#{formData.order}</span>
                  </div>
                  {formData._uploadedFile && (
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Source File:</span>
                      <span className="font-medium">{formData._uploadedFile.name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Data Layers</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <span className="text-foreground-muted">Bronze:</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {formData.destinationConfig.bronzeConfig?.tableName || 'Not configured'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    <span className="text-foreground-muted">Silver:</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {formData.destinationConfig.silverConfig?.tableName || 'Not configured'}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-foreground-muted">Gold:</span>
                    <code className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                      {formData.destinationConfig.goldConfig?.tableName || 'Not configured'}
                    </code>
                  </div>
                </CardContent>
              </Card>

              {formData._detectedSchema && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-green-900">Ready to Process</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-green-800">
                    <p>
                      Your job is configured and ready to process <strong>{formData._detectedSchema.length} columns</strong> through the medallion architecture.
                      Click "Create Job" to add this job to your workflow.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create New Job</DialogTitle>
          <DialogDescription>
            Configure a new data processing job for your workflow
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress */}
        <div className="mb-6 px-6">
          <div className="flex items-center justify-center space-x-2 mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors',
                  currentStep === step.id
                    ? 'bg-primary text-white'
                    : currentStep > step.id
                    ? 'bg-success text-white'
                    : 'bg-background-tertiary text-foreground-muted'
                )}>
                  {currentStep > step.id ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    step.id
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    'w-8 h-0.5 mx-1',
                    currentStep > step.id ? 'bg-success' : 'bg-background-tertiary'
                  )} />
                )}
              </div>
            ))}
          </div>

          <div className="text-center">
            <h3 className="font-semibold text-foreground">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-foreground-muted mt-1">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {renderStepContent()}
        </div>

        <DialogFooter>
          <div className="flex justify-between w-full">
            <div>
              {currentStep > 1 && (
                <Button variant="outline" onClick={prevStep}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Button>
              )}
            </div>
            <div className="flex space-x-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              {currentStep < 3 ? (
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}