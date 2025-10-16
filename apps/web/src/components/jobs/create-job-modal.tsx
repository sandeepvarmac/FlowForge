'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield, AlertCircle, Eye, HardDrive, Sparkles, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSVFileUpload } from './csv-file-upload'

interface CreateJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onJobCreate: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>, uploadedFile?: File) => void
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
      auditColumns: true,
      auditColumnsBatchId: false,
      auditColumnsSourceSystem: false,
      auditColumnsFileModified: false,
      compression: 'snappy',
      schemaEvolution: 'strict'
    },
    silverConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      updateStrategy: 'update_all',
      conflictResolution: 'source_wins',
      surrogateKeyStrategy: 'auto_increment',
      surrogateKeyColumn: '_surrogate_key',
      primaryKey: ''
    },
    goldConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet',
      buildStrategy: 'full_rebuild',
      materializationType: 'table',
      compression: 'zstd',
      aggregationEnabled: false,
      denormalizationEnabled: false,
      exportEnabled: false
    }
  }
}

const steps = [
  { id: 1, title: 'Job Basics & Source', description: 'Select job type and upload data', icon: Upload },
  { id: 2, title: 'Bronze Layer', description: 'Configure raw data ingestion', icon: Database },
  { id: 3, title: 'Silver Layer', description: 'Configure cleaned & validated data', icon: Shield },
  { id: 4, title: 'Gold Layer', description: 'Configure analytics-ready data', icon: Sparkles },
  { id: 5, title: 'Review & Create', description: 'Review configuration and create job', icon: CheckCircle }
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
  },
  {
    value: 'streaming',
    label: 'Streaming',
    icon: Activity,
    description: 'Kafka, Kinesis, Event Hubs, Pub/Sub, CDC',
    enabled: false,
    badge: 'Coming Soon'
  }
]

export function CreateJobModal({ open, onOpenChange, workflowId, onJobCreate }: CreateJobModalProps) {
  const [currentStep, setCurrentStep] = React.useState(1)
  const [formData, setFormData] = React.useState<JobFormData>(initialFormData)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const csvUploadRef = React.useRef<{ reset: () => void }>(null)

  const resetForm = () => {
    setFormData(initialFormData)
    setCurrentStep(1)
    setErrors({})
    csvUploadRef.current?.reset()
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
        if (!formData._uploadedFile) newErrors.file = 'File upload is required'
        break
      case 2:
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) {
          newErrors.bronzeTable = 'Bronze table name is required'
        }
        break
      case 3:
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) {
            newErrors.silverTable = 'Silver table name is required'
          }
        }
        break
      case 4:
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) {
            newErrors.goldTable = 'Gold table name is required'
          }
        }
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 5))
      // Scroll to top of modal content
      setTimeout(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }, 0)
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
    // Scroll to top of modal content
    setTimeout(() => {
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }, 0)
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

    onJobCreate(job, formData._uploadedFile)
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
                  <FormLabel>File Source Location</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {/* Manual upload is default */}}
                      className="p-4 border border-primary bg-primary-50 shadow-md ring-2 ring-primary ring-opacity-50 rounded-lg text-left transition-all"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Upload className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">Manual Upload</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        Upload files directly from your computer
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="p-4 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50 relative"
                    >
                      <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
                        Coming Soon
                      </Badge>
                      <div className="flex items-center gap-2 mb-2">
                        <Cloud className="w-4 h-4 text-foreground-muted" />
                        <span className="font-semibold text-sm">Cloud Storage</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        S3, Azure Blob, GCS buckets
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="p-4 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50 relative"
                    >
                      <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
                        Coming Soon
                      </Badge>
                      <div className="flex items-center gap-2 mb-2">
                        <Database className="w-4 h-4 text-foreground-muted" />
                        <span className="font-semibold text-sm">SFTP/FTP Server</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        Secure file transfer protocols
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled
                      className="p-4 border border-border rounded-lg text-left opacity-50 cursor-not-allowed bg-gray-50 relative"
                    >
                      <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
                        Coming Soon
                      </Badge>
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="w-4 h-4 text-foreground-muted" />
                        <span className="font-semibold text-sm">Network Share</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        On-premise file servers
                      </p>
                    </button>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">
                    Select where your source files are located. File format will be auto-detected when you upload.
                  </p>
                </FormField>

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
                      <option value="single">Single File (Upload one file)</option>
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
                      Example: customer_*.csv will match customer_2024.csv, customer_jan.csv, etc. Format is auto-detected from file extension.
                    </div>
                  </FormField>
                )}

                <FormField>
                  <FormLabel required>
                    {formData.sourceConfig.fileConfig?.uploadMode === 'pattern'
                      ? 'Sample File (for schema detection)'
                      : 'Data File'}
                  </FormLabel>
                  <CSVFileUpload
                    ref={csvUploadRef}
                    onFileUpload={(file, schema, preview, columnMappings) => {
                      // Auto-generate table names from filename
                      const cleanName = file.name.replace(/\.[^/.]+$/, "").toLowerCase().replace(/[^a-z0-9]/g, '_')

                      updateSourceConfig({
                        name: file.name.replace(/\.[^/.]+$/, ""),
                        fileConfig: {
                          ...formData.sourceConfig.fileConfig!,
                          filePath: file.name,
                          filePattern: file.name,
                          // Store hasHeader flag - false if column mappings exist (headerless CSV)
                          hasHeader: !columnMappings || columnMappings.length === 0
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

                      // Store column mappings in transformationConfig if provided (headerless CSV)
                      const transformationConfig = columnMappings && columnMappings.length > 0
                        ? {
                            columnMappings: columnMappings,
                            useDirectSql: false
                          }
                        : undefined

                      setFormData(prev => ({
                        ...prev,
                        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
                        _uploadedFile: file,
                        _detectedSchema: schema,
                        _previewData: preview,
                        transformationConfig: transformationConfig
                      } as any))
                    }}
                    onReset={() => {
                      // Clear form data related to file upload
                      setFormData(prev => ({
                        ...prev,
                        _uploadedFile: undefined,
                        _detectedSchema: undefined,
                        _previewData: undefined
                      }))
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-900 mb-1">Bronze Layer Configuration</h4>
                  <p className="text-sm text-amber-800">
                    Configure raw data ingestion with minimal transformation. This layer stores data exactly as received from the source.
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

                {/* Load Strategy - NEW */}
                <FormField>
                  <FormLabel>Load Strategy</FormLabel>
                  <Select
                    value={formData.destinationConfig.bronzeConfig?.loadStrategy || 'append'}
                    onChange={(e) => updateDestinationConfig({
                      bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, loadStrategy: e.target.value as any }
                    })}
                  >
                    <option value="append">Append (Add all rows - Recommended)</option>
                    <option value="full_refresh">Full Refresh (Truncate and reload)</option>
                    <option value="incremental" disabled>Incremental (Coming Soon)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.bronzeConfig?.loadStrategy === 'append' && 'New data is added to existing records without removing old data'}
                    {formData.destinationConfig.bronzeConfig?.loadStrategy === 'full_refresh' && 'All existing data is deleted before loading new data'}
                    {formData.destinationConfig.bronzeConfig?.loadStrategy === 'incremental' && 'Only new/changed records are loaded based on watermark column'}
                  </p>
                </FormField>

                {/* Incremental Load Configuration - Coming Soon */}
                {formData.destinationConfig.bronzeConfig?.loadStrategy === 'incremental' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                      <span className="text-sm font-medium text-blue-900">Incremental Load Configuration</span>
                    </div>
                    <div className="space-y-2 text-xs text-blue-700">
                      <div>• Watermark column selection (timestamp/date/integer)</div>
                      <div>• Lookback window configuration</div>
                      <div>• Change data capture (CDC) support</div>
                    </div>
                  </div>
                )}

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

                {/* Enhanced Audit Columns */}
                <FormField>
                  <div className="flex items-center justify-between mb-2">
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
                  <p className="text-xs text-foreground-muted mb-3">
                    Automatically add tracking columns to your data
                  </p>

                  {formData.destinationConfig.bronzeConfig?.auditColumns && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="text-xs font-medium text-foreground mb-2">Standard Columns (Always Added):</div>
                      <div className="space-y-1 text-xs text-foreground-muted ml-2">
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_ingested_at</code> - Timestamp when row was ingested</div>
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_source_file</code> - Original source file name</div>
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_row_number</code> - Row position in source file</div>
                      </div>

                      <div className="border-t border-gray-200 pt-2 mt-3">
                        <div className="text-xs font-medium text-foreground mb-2">Additional Columns:</div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsBatchId || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsBatchId: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_batch_id</code> - Unique batch identifier (UUID)
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsSourceSystem || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsSourceSystem: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_source_system</code> - Source system name
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsFileModified || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsFileModified: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_file_modified_at</code> - File last modified timestamp
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </FormField>

                {/* Partitioning - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Partitioning</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Improve query performance by partitioning data based on columns
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Partition by date columns (YYYY/MM/DD)</div>
                    <div>• Partition by categorical columns</div>
                    <div>• Hive / Delta / Iceberg partitioning strategies</div>
                    <div>• Automatic partition pruning optimization</div>
                  </div>
                </div>

                {/* Schema Evolution - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Schema Evolution</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Handle schema changes automatically when source data structure changes
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• <strong>Strict Mode:</strong> Fail on schema mismatch (recommended for production)</div>
                    <div>• <strong>Add New Columns:</strong> Automatically add new columns from source</div>
                    <div>• <strong>Ignore Extra:</strong> Ignore columns not in target schema</div>
                    <div>• Column type change detection and warnings</div>
                  </div>
                </div>

                {/* Data Quality Checks - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Data Quality Checks</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Validate data quality at ingestion time
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Reject duplicate rows (based on all columns)</div>
                    <div>• Reject rows with all nulls</div>
                    <div>• Maximum null percentage threshold</div>
                    <div>• Minimum row count validation</div>
                    <div>• File size validation and warnings</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-gray-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Silver Layer Configuration</h4>
                  <p className="text-sm text-gray-800">
                    Configure data quality rules, deduplication, and transformations. This layer provides cleaned and validated data.
                  </p>
                </div>
              </div>
            </div>

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
                    <option value="iceberg" disabled>Apache Iceberg (Coming Soon)</option>
                  </Select>
                </FormField>

                {/* Deduplication Strategy - Enhanced */}
                <FormField>
                  <FormLabel>Deduplication Strategy</FormLabel>
                  <Select
                    value={formData.destinationConfig.silverConfig?.mergeStrategy || 'merge'}
                    onChange={(e) => updateDestinationConfig({
                      silverConfig: { ...formData.destinationConfig.silverConfig!, mergeStrategy: e.target.value as any }
                    })}
                    disabled={formData.destinationConfig.silverConfig?.enabled === false}
                  >
                    <option value="merge">Merge/Upsert (Recommended)</option>
                    <option value="full_refresh">Full Refresh (Truncate & Reload)</option>
                    <option value="append">Append Only (No Deduplication)</option>
                    <option value="scd_type_2" disabled>SCD Type 2 (Coming Soon)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'merge' && 'Updates existing records and inserts new ones based on primary key'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'full_refresh' && 'Deletes all existing data and reloads from Bronze'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'append' && 'Adds all records without checking for duplicates'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'scd_type_2' && 'Tracks historical changes with effective dates'}
                  </p>
                </FormField>

                {/* Primary Key Configuration - Enhanced for Composite Keys */}
                {formData.destinationConfig.silverConfig?.mergeStrategy === 'merge' && (
                  <FormField>
                    <FormLabel>Primary Key (for Deduplication)</FormLabel>
                    <Select
                      value={formData.destinationConfig.silverConfig?.primaryKey || ''}
                      onChange={(e) => updateDestinationConfig({
                        silverConfig: { ...formData.destinationConfig.silverConfig!, primaryKey: e.target.value }
                      })}
                      disabled={formData.destinationConfig.silverConfig?.enabled === false}
                    >
                      <option value="">Select primary key...</option>
                      {formData._detectedSchema?.map(col => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-foreground-muted mt-1">
                      Used to identify unique records for merge operations
                    </p>

                    {/* Composite Key Notice - Coming Soon */}
                    <div className="bg-blue-50 border border-blue-200 rounded-md p-2 mt-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                        <span className="text-xs text-blue-800">Composite Keys (Multiple Columns)</span>
                      </div>
                      <p className="text-[11px] text-blue-700 mt-1">
                        Select multiple columns as a composite primary key (e.g., customer_id + order_date)
                      </p>
                    </div>
                  </FormField>
                )}

                {/* Merge Configuration - Only for Merge Strategy */}
                {formData.destinationConfig.silverConfig?.mergeStrategy === 'merge' && formData.destinationConfig.silverConfig?.primaryKey && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                    <div className="text-xs font-medium text-foreground">Merge Behavior</div>

                    <FormField>
                      <FormLabel className="text-xs">Update Strategy</FormLabel>
                      <Select
                        value={formData.destinationConfig.silverConfig?.updateStrategy || 'update_all'}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, updateStrategy: e.target.value as any }
                        })}
                        className="text-xs h-8"
                      >
                        <option value="update_all">Update All Columns</option>
                        <option value="update_changed" disabled>Update Only Changed (Coming Soon)</option>
                        <option value="custom" disabled>Custom Columns (Coming Soon)</option>
                      </Select>
                    </FormField>

                    <FormField>
                      <FormLabel className="text-xs">Conflict Resolution</FormLabel>
                      <Select
                        value={formData.destinationConfig.silverConfig?.conflictResolution || 'source_wins'}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, conflictResolution: e.target.value as any }
                        })}
                        className="text-xs h-8"
                      >
                        <option value="source_wins">Source Wins (Overwrite)</option>
                        <option value="target_wins" disabled>Target Wins (Coming Soon)</option>
                        <option value="most_recent" disabled>Most Recent Timestamp (Coming Soon)</option>
                      </Select>
                      <p className="text-[11px] text-foreground-muted mt-1">
                        How to resolve conflicts when the same record exists in both source and target
                      </p>
                    </FormField>
                  </div>
                )}

                {/* Surrogate Key Configuration */}
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
                    <option value="uuid">UUID (Globally Unique)</option>
                    <option value="hash" disabled>Hash (Coming Soon)</option>
                    <option value="use_existing">Use Existing Column</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    Generates a unique identifier ({formData.destinationConfig.silverConfig?.surrogateKeyColumn || '_surrogate_key'}) for each record
                  </p>
                </FormField>

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

                {/* SCD Type 2 Configuration - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Slowly Changing Dimension (SCD) Type 2</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Track historical changes to records with effective dates
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Natural key selection (business key)</div>
                    <div>• Effective date column (_valid_from)</div>
                    <div>• End date column (_valid_to)</div>
                    <div>• Current flag column (_is_current)</div>
                    <div>• Track deleted records with soft deletes</div>
                    <div>• Automatic versioning and history management</div>
                  </div>
                </div>

                {/* Data Quality Rules - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Data Quality Rules</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Validate data quality at the Silver layer
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• <strong>Column-level rules:</strong> Not null, unique, regex patterns, min/max values</div>
                    <div>• <strong>Row-level rules:</strong> Cross-column validation (e.g., start_date &lt; end_date)</div>
                    <div>• <strong>SQL expressions:</strong> Custom validation logic</div>
                    <div>• <strong>Quality thresholds:</strong> Fail job, quarantine bad rows, or log warnings</div>
                    <div>• <strong>Quarantine table:</strong> Isolate invalid records for review</div>
                  </div>
                </div>

                {/* Column Transformations - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Column Transformations</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Apply transformations to clean and standardize data
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Trim whitespace, uppercase/lowercase</div>
                    <div>• Date parsing with auto-format detection</div>
                    <div>• Email validation and normalization</div>
                    <div>• Phone number formatting (international support)</div>
                    <div>• Remove special characters</div>
                    <div>• Type casting with error handling</div>
                    <div>• Derived columns with SQL expressions</div>
                    <div>• Column renaming and reordering</div>
                  </div>
                </div>

                {/* PII Masking - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">PII Masking & Data Privacy</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Protect sensitive data with masking strategies
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• <strong>Hash:</strong> One-way hashing (irreversible)</div>
                    <div>• <strong>Tokenize:</strong> Reversible with encryption key</div>
                    <div>• <strong>Partial mask:</strong> Show last 4 digits (e.g., ****1234)</div>
                    <div>• <strong>Full mask:</strong> Replace with XXXXX</div>
                    <div>• <strong>Null out:</strong> Remove sensitive data entirely</div>
                    <div>• Tag columns as: PII, PHI, Confidential</div>
                    <div>• Compliance presets: GDPR, HIPAA, CCPA</div>
                  </div>
                </div>

                {/* Performance Optimization - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Performance Optimization</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Optimize query performance for large datasets
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Partitioning by date or categorical columns</div>
                    <div>• Clustering (Delta/Iceberg)</div>
                    <div>• Z-ordering (Delta Lake)</div>
                    <div>• Automatic statistics collection</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-yellow-900 mb-1">Gold Layer Configuration</h4>
                  <p className="text-sm text-yellow-800">
                    Configure analytics-optimized data for reporting and business intelligence. This layer provides business-ready datasets.
                  </p>
                </div>
              </div>
            </div>

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

                {/* Build Strategy - Enhanced */}
                <FormField>
                  <FormLabel>Build Strategy</FormLabel>
                  <Select
                    value={formData.destinationConfig.goldConfig?.buildStrategy || 'full_rebuild'}
                    onChange={(e) => updateDestinationConfig({
                      goldConfig: { ...formData.destinationConfig.goldConfig!, buildStrategy: e.target.value as any }
                    })}
                    disabled={formData.destinationConfig.goldConfig?.enabled === false}
                  >
                    <option value="full_rebuild">Full Rebuild (Recommended)</option>
                    <option value="incremental" disabled>Incremental (Coming Soon)</option>
                    <option value="snapshot" disabled>Snapshot (Coming Soon)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.goldConfig?.buildStrategy === 'full_rebuild' && 'Rebuild entire table from Silver layer on each run'}
                    {formData.destinationConfig.goldConfig?.buildStrategy === 'incremental' && 'Only process new/changed records from Silver layer'}
                  </p>
                </FormField>

                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Storage Format</FormLabel>
                    <Select
                      value={formData.destinationConfig.goldConfig?.storageFormat || 'parquet'}
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
                    <FormLabel>Compression</FormLabel>
                    <Select
                      value={formData.destinationConfig.goldConfig?.compression || 'zstd'}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, compression: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.goldConfig?.enabled === false}
                    >
                      <option value="snappy">Snappy (Balanced)</option>
                      <option value="gzip">GZIP (High Compression)</option>
                      <option value="zstd">Zstandard (Best - Recommended)</option>
                      <option value="none">None</option>
                    </Select>
                    <p className="text-xs text-foreground-muted mt-1">Balance between storage size and query speed</p>
                  </FormField>
                </div>

                {/* Materialization Type */}
                <FormField>
                  <FormLabel>Materialization Type</FormLabel>
                  <Select
                    value={formData.destinationConfig.goldConfig?.materializationType || 'table'}
                    onChange={(e) => updateDestinationConfig({
                      goldConfig: { ...formData.destinationConfig.goldConfig!, materializationType: e.target.value as any }
                    })}
                    disabled={formData.destinationConfig.goldConfig?.enabled === false}
                  >
                    <option value="table">Table (Physical Storage - Recommended)</option>
                    <option value="view" disabled>View (Coming Soon)</option>
                    <option value="materialized_view" disabled>Materialized View (Coming Soon)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.goldConfig?.materializationType === 'table' && 'Physical table with stored data for fast queries'}
                    {formData.destinationConfig.goldConfig?.materializationType === 'view' && 'Virtual view that queries Silver on demand'}
                    {formData.destinationConfig.goldConfig?.materializationType === 'materialized_view' && 'Pre-computed view with auto-refresh'}
                  </p>
                </FormField>

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

                {/* Aggregation Configuration - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Aggregation Configuration</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Create pre-aggregated analytics tables for faster reporting
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Group by columns (dimensions)</div>
                    <div>• Aggregation functions: SUM, AVG, MIN, MAX, COUNT, COUNT_DISTINCT</div>
                    <div>• Time grain selection: Daily, Weekly, Monthly, Yearly</div>
                    <div>• Multiple aggregation rules per table</div>
                    <div>• Window functions for advanced analytics</div>
                  </div>
                </div>

                {/* Denormalization - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Denormalization (Joins)</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Join with other Silver tables to create wide, analytics-friendly tables
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Join with other Silver tables</div>
                    <div>• Join types: INNER, LEFT, RIGHT, FULL OUTER</div>
                    <div>• Multi-table joins (star schema support)</div>
                    <div>• Column selection from joined tables</div>
                    <div>• Automatic dimension flattening</div>
                  </div>
                </div>

                {/* Business Logic - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Business Logic</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Apply business rules and calculated fields
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Calculated columns with SQL expressions</div>
                    <div>• Filter conditions (WHERE clause)</div>
                    <div>• Custom SQL (advanced users)</div>
                    <div>• Business KPIs and metrics</div>
                  </div>
                </div>

                {/* Performance & Optimization - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Performance & Optimization</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Optimize for query performance at scale
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Partitioning by date or business dimensions</div>
                    <div>• Indexing (Iceberg/Delta only)</div>
                    <div>• Z-ordering for Delta Lake</div>
                    <div>• Clustering for Snowflake/BigQuery</div>
                    <div>• Statistics collection for query optimization</div>
                  </div>
                </div>

                {/* Export Configuration - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Export to External Systems</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Automatically export Gold data to downstream systems
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• <strong>S3/Parquet:</strong> Export to S3 in Parquet format</div>
                    <div>• <strong>Snowflake:</strong> Create external table or COPY INTO</div>
                    <div>• <strong>Google BigQuery:</strong> Export to BigQuery table</div>
                    <div>• <strong>Azure Synapse:</strong> Export to Synapse Analytics</div>
                    <div>• <strong>PostgreSQL/MySQL:</strong> Export to relational databases</div>
                    <div>• <strong>Excel/CSV:</strong> Download for business users</div>
                    <div>• Schedule: On job completion, Daily, Weekly</div>
                  </div>
                </div>

                {/* Analytics Metadata - Coming Soon */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                    <span className="text-sm font-medium text-blue-900">Analytics Metadata</span>
                  </div>
                  <p className="text-xs text-blue-700 mb-2">
                    Add business context and enable data catalog integration
                  </p>
                  <div className="space-y-1 text-xs text-blue-700 ml-2">
                    <div>• Business-friendly name and description</div>
                    <div>• Data owner and steward assignment</div>
                    <div>• Tags: finance, marketing, operations, kpi</div>
                    <div>• Data lineage tracking</div>
                    <div>• Sync to data catalog (Alation, Collibra, DataHub)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 5:
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

  const handleModalClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm()
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
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
            {steps.map((step, index) => {
              const StepIcon = step.icon
              return (
                <div key={step.id} className="flex items-center">
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-colors',
                    currentStep === step.id
                      ? 'bg-primary text-white'
                      : currentStep > step.id
                      ? 'bg-success text-white'
                      : 'bg-background-tertiary text-foreground-muted'
                  )}>
                    {currentStep > step.id ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <StepIcon className="w-4 h-4" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className={cn(
                      'w-12 h-0.5 mx-1',
                      currentStep > step.id ? 'bg-success' : 'bg-background-tertiary'
                    )} />
                  )}
                </div>
              )
            })}
          </div>

          <div className="text-center">
            <h3 className="font-semibold text-foreground">{steps[currentStep - 1].title}</h3>
            <p className="text-sm text-foreground-muted mt-1">{steps[currentStep - 1].description}</p>
          </div>
        </div>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 pb-6">
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
              <Button variant="ghost" onClick={() => handleModalClose(false)}>
                Cancel
              </Button>
              {currentStep < 5 ? (
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