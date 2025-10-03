'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield, AlertCircle, Eye } from 'lucide-react'
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
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-4">
              Job Information
            </div>
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
              <div className="grid grid-cols-3 gap-4 mt-3">
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
                      'p-5 border rounded-lg text-left transition-all hover:shadow-md min-h-[100px] flex flex-col justify-center',
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
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-4">
              Data Source Configuration
            </div>
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

                <div className="grid grid-cols-2 gap-6">
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
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-4">
              {formData.type === 'file-based' ? 'File Configuration' : 
               formData.type === 'database' ? 'Query Configuration' : 
               'API Configuration'}
            </div>
            {formData.type === 'file-based' && (
              <>
                {/* CSV File Upload */}
                <FormField>
                  <FormLabel>Upload CSV File</FormLabel>
                  <CSVFileUpload 
                    onFileUpload={(file, schema, preview) => {
                      updateSourceConfig({
                        name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension for name
                        fileConfig: { 
                          ...formData.sourceConfig.fileConfig!, 
                          filePath: file.name,
                          filePattern: file.name
                        }
                      })
                      // Store file data for processing
                      setFormData(prev => ({
                        ...prev,
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
                </FormField>

                <FormField>
                  <FormLabel>File Pattern</FormLabel>
                  <Input
                    value={formData.sourceConfig.fileConfig?.filePattern || ''}
                    onChange={(e) => updateSourceConfig({
                      fileConfig: { ...formData.sourceConfig.fileConfig!, filePattern: e.target.value }
                    })}
                    placeholder="customers_*.csv"
                  />
                </FormField>

                <div className="grid grid-cols-2 gap-6">
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
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <button
                      type="button"
                      onClick={() => updateSourceConfig({
                        databaseConfig: { ...formData.sourceConfig.databaseConfig, tableName: '', query: 'SELECT * FROM table_name', storedProcedure: '', isIncremental: false }
                      })}
                      className={cn(
                        'p-4 border rounded-lg text-left transition-all hover:shadow-md min-h-[80px] flex flex-col justify-center',
                        formData.sourceConfig.databaseConfig?.query ? 'border-primary bg-primary-50 shadow-md' : 'border-border hover:border-primary-200'
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
                        'p-4 border rounded-lg text-left transition-all hover:shadow-md min-h-[80px] flex flex-col justify-center',
                        formData.sourceConfig.databaseConfig?.tableName ? 'border-primary bg-primary-50 shadow-md' : 'border-border hover:border-primary-200'
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
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-2">
              Destination Layers
            </div>
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
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-2">
              Data Transformations
            </div>
            <div className="text-sm text-foreground-muted mb-4">
              Configure column mappings, data type conversions, and transformation rules for your CSV data.
            </div>

            {formData._detectedSchema ? (
              <>
                {/* Column Mappings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowRight className="w-5 h-5 text-primary" />
                      Column Mappings & Transformations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="text-sm text-foreground-muted mb-3">
                        Map your CSV columns to target schema and define transformations:
                      </div>
                      
                      <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                        <table className="w-full">
                          <thead className="bg-gray-50">
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[200px]">Source Column</th>
                              <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[120px]">Source Type</th>
                              <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[200px]">Target Column</th>
                              <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[140px]">Target Type</th>
                              <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[220px]">Transformation</th>
                            </tr>
                          </thead>
                          <tbody>
                            {formData._detectedSchema.map((col, index) => (
                              <tr key={index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                                <td className="py-4 px-6">
                                  <div className="space-y-1">
                                    <div className="font-semibold font-mono text-gray-800 text-sm">{col.name}</div>
                                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono">
                                      {col.sample ? `"${col.sample}"` : 'No sample'}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-6">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs font-medium ${
                                      col.type === 'integer' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                      col.type === 'decimal' ? 'border-green-300 text-green-700 bg-green-50' :
                                      col.type === 'date' ? 'border-purple-300 text-purple-700 bg-purple-50' :
                                      col.type === 'email' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                      col.type === 'phone' ? 'border-pink-300 text-pink-700 bg-pink-50' :
                                      'border-gray-300 text-gray-700 bg-gray-50'
                                    }`}
                                  >
                                    {col.type}
                                  </Badge>
                                </td>
                                <td className="py-4 px-6">
                                  <Input
                                    className="font-mono text-sm w-full min-w-[180px]"
                                    defaultValue={col.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}
                                    placeholder="target_column_name"
                                  />
                                </td>
                                <td className="py-4 px-6">
                                  <Select defaultValue={col.type} className="w-full min-w-[120px]">
                                    <option value="string">String</option>
                                    <option value="integer">Integer</option>
                                    <option value="decimal">Decimal</option>
                                    <option value="date">Date</option>
                                    <option value="boolean">Boolean</option>
                                    <option value="email">Email</option>
                                    <option value="phone">Phone</option>
                                  </Select>
                                </td>
                                <td className="py-4 px-6">
                                  <Select defaultValue="none" className="w-full min-w-[200px]">
                                    <option value="none">No transformation</option>
                                    <option value="uppercase">UPPERCASE</option>
                                    <option value="lowercase">lowercase</option>
                                    <option value="trim">Trim whitespace</option>
                                    <option value="standardize_phone">Standardize phone format</option>
                                    <option value="validate_email">Validate email format</option>
                                    <option value="parse_date">Parse date format</option>
                                    <option value="remove_special">Remove special characters</option>
                                  </Select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Business Rules */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings className="w-5 h-5 text-primary" />
                      Business Rules & Calculated Fields
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField>
                          <FormLabel>Customer Segmentation Rule</FormLabel>
                          <Select defaultValue="revenue_based">
                            <option value="revenue_based">Revenue-based (Enterprise/Premium/Standard)</option>
                            <option value="activity_based">Activity-based segmentation</option>
                            <option value="geographic">Geographic segmentation</option>
                            <option value="custom">Custom rule</option>
                          </Select>
                        </FormField>

                        <FormField>
                          <FormLabel>Data Quality Actions</FormLabel>
                          <Select defaultValue="flag_and_continue">
                            <option value="flag_and_continue">Flag issues and continue</option>
                            <option value="fail_on_critical">Fail on critical issues</option>
                            <option value="auto_fix">Auto-fix when possible</option>
                            <option value="manual_review">Send to manual review</option>
                          </Select>
                        </FormField>
                      </div>

                      <FormField>
                        <FormLabel>Calculated Fields</FormLabel>
                        <div className="space-y-2">
                          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <span className="font-mono text-sm">customer_lifetime_value</span>
                            <span className="text-sm text-foreground-muted">=</span>
                            <code className="text-sm bg-white px-2 py-1 rounded border">revenue * 12 / customer_age_months</code>
                          </div>
                          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <span className="font-mono text-sm">full_name</span>
                            <span className="text-sm text-foreground-muted">=</span>
                            <code className="text-sm bg-white px-2 py-1 rounded border">CONCAT(first_name, ' ', last_name)</code>
                          </div>
                          <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                            <span className="font-mono text-sm">is_active_customer</span>
                            <span className="text-sm text-foreground-muted">=</span>
                            <code className="text-sm bg-white px-2 py-1 rounded border">status = 'active' AND last_purchase_date > DATEADD(months, -6, GETDATE())</code>
                          </div>
                        </div>
                      </FormField>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-foreground-muted">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                <p className="font-medium">No CSV data detected</p>
                <p className="text-sm mt-2">Please upload a CSV file in Step 3 to configure transformations</p>
              </div>
            )}
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-2">
              Data Validation & Quality Rules
            </div>
            <div className="text-sm text-foreground-muted mb-4">
              Configure validation rules and data quality checks to ensure data integrity throughout the pipeline.
            </div>

            {formData._detectedSchema ? (
              <>
                {/* Data Quality Rules */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      Data Quality Validation Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField>
                          <FormLabel>Null Value Tolerance</FormLabel>
                          <Select defaultValue="moderate">
                            <option value="strict">Strict (0% nulls allowed)</option>
                            <option value="moderate">Moderate (≤20% nulls)</option>
                            <option value="relaxed">Relaxed (≤50% nulls)</option>
                            <option value="permissive">Permissive (any nulls allowed)</option>
                          </Select>
                        </FormField>

                        <FormField>
                          <FormLabel>Duplicate Record Handling</FormLabel>
                          <Select defaultValue="flag">
                            <option value="reject">Reject duplicates</option>
                            <option value="flag">Flag and continue</option>
                            <option value="dedupe_first">Keep first occurrence</option>
                            <option value="dedupe_last">Keep last occurrence</option>
                          </Select>
                        </FormField>

                        <FormField>
                          <FormLabel>Data Type Validation</FormLabel>
                          <Select defaultValue="strict">
                            <option value="strict">Strict type checking</option>
                            <option value="coerce">Auto-coerce when possible</option>
                            <option value="flexible">Flexible parsing</option>
                          </Select>
                        </FormField>

                        <FormField>
                          <FormLabel>Email Validation Level</FormLabel>
                          <Select defaultValue="format">
                            <option value="none">No validation</option>
                            <option value="format">Format validation only</option>
                            <option value="domain">Format + domain check</option>
                            <option value="full">Full email verification</option>
                          </Select>
                        </FormField>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Column-Specific Rules */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-primary" />
                      Column-Specific Validation Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[220px]">Column Details</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[100px] text-center">Required</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[200px]">Validation Rule</th>
                            <th className="text-left py-4 px-6 font-semibold text-gray-700 min-w-[180px]">Action on Failure</th>
                          </tr>
                        </thead>
                        <tbody>
                          {formData._detectedSchema.map((col, index) => (
                            <tr key={index} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                              <td className="py-4 px-6">
                                <div className="space-y-2">
                                  <div className="font-semibold font-mono text-gray-800">{col.name}</div>
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs font-medium ${
                                        col.type === 'integer' ? 'border-blue-300 text-blue-700 bg-blue-50' :
                                        col.type === 'decimal' ? 'border-green-300 text-green-700 bg-green-50' :
                                        col.type === 'date' ? 'border-purple-300 text-purple-700 bg-purple-50' :
                                        col.type === 'email' ? 'border-orange-300 text-orange-700 bg-orange-50' :
                                        col.type === 'phone' ? 'border-pink-300 text-pink-700 bg-pink-50' :
                                        'border-gray-300 text-gray-700 bg-gray-50'
                                      }`}
                                    >
                                      {col.type}
                                    </Badge>
                                  </div>
                                  {col.sample && (
                                    <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded font-mono max-w-[200px] truncate">
                                      Sample: "{col.sample}"
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="py-4 px-6 text-center">
                                <input
                                  type="checkbox"
                                  defaultChecked={['customer_id', 'email', 'first_name', 'last_name'].includes(col.name)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="py-4 px-6">
                                <Select 
                                  defaultValue={
                                    col.type === 'email' ? 'email_format' :
                                    col.type === 'phone' ? 'phone_format' :
                                    col.type === 'integer' ? 'positive_number' :
                                    col.name.includes('date') ? 'valid_date' :
                                    'not_empty'
                                  }
                                  className="w-full min-w-[180px]"
                                >
                                  <option value="none">No validation</option>
                                  <option value="not_empty">Not empty</option>
                                  <option value="email_format">Valid email format</option>
                                  <option value="phone_format">Valid phone format</option>
                                  <option value="positive_number">Positive number</option>
                                  <option value="valid_date">Valid date format</option>
                                  <option value="length_range">Length within range</option>
                                  <option value="regex_pattern">Custom regex pattern</option>
                                </Select>
                              </td>
                              <td className="py-4 px-6">
                                <Select defaultValue="flag" className="w-full min-w-[160px]">
                                  <option value="fail">Fail job</option>
                                  <option value="flag">Flag and continue</option>
                                  <option value="skip">Skip record</option>
                                  <option value="default">Use default value</option>
                                </Select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Reconciliation Rules */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      Data Reconciliation & Monitoring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField>
                          <FormLabel>Row Count Validation</FormLabel>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" defaultChecked />
                              <span className="text-sm">Validate expected row count</span>
                            </label>
                            <Input placeholder="Expected rows (e.g., 30)" defaultValue="30" />
                          </div>
                        </FormField>

                        <FormField>
                          <FormLabel>Business Rule Checks</FormLabel>
                          <div className="space-y-2">
                            <label className="flex items-center gap-2">
                              <input type="checkbox" defaultChecked />
                              <span className="text-sm">Revenue values must be positive</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" defaultChecked />
                              <span className="text-sm">Registration date cannot be future</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input type="checkbox" defaultChecked />
                              <span className="text-sm">Customer segments must match revenue</span>
                            </label>
                          </div>
                        </FormField>
                      </div>

                      <FormField>
                        <FormLabel>Data Freshness Monitoring</FormLabel>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium mb-1">Expected File Age</label>
                            <Select defaultValue="daily">
                              <option value="hourly">Updated hourly</option>
                              <option value="daily">Updated daily</option>
                              <option value="weekly">Updated weekly</option>
                              <option value="monthly">Updated monthly</option>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Tolerance Window</label>
                            <Input placeholder="2 hours" defaultValue="2 hours" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium mb-1">Alert Method</label>
                            <Select defaultValue="email">
                              <option value="email">Email notification</option>
                              <option value="slack">Slack notification</option>
                              <option value="dashboard">Dashboard alert</option>
                              <option value="webhook">Webhook</option>
                            </Select>
                          </div>
                        </div>
                      </FormField>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <div className="text-center py-8 text-foreground-muted">
                <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
                <p className="font-medium">No CSV data detected</p>
                <p className="text-sm mt-2">Please upload a CSV file in Step 3 to configure validation rules</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="6xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}