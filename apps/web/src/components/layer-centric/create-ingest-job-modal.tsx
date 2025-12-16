"use client"

import * as React from "react"
import { Button, Input, Badge, useToast } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FormField, FormLabel, FormError, Textarea, Select } from "@/components/ui/form"
import {
  Upload,
  Cloud,
  HardDrive,
  FileText,
  Database,
  Info,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Table,
  AlertTriangle,
  Lightbulb
} from "lucide-react"

// AI Schema Analysis types
interface AIEnhancedColumn {
  name: string
  detectedType: string
  semanticType: string
  description: string
  dataFormat?: string
  businessMeaning?: string
  suggestedValidations: string[]
}

interface AISchemaAnalysis {
  enhancedSchema: AIEnhancedColumn[]
  suggestions: {
    dataQuality: Array<{
      type: string
      severity: 'warning' | 'error' | 'info'
      message: string
      column?: string
    }>
    transformations: Array<{
      column: string
      suggestion: string
      transformation: string
      reason: string
    }>
    insights: string[]
    qualityScore: number
  }
}

interface UploadResult {
  success: boolean
  filepath: string
  landingKey: string
  rowCount: number
  columnCount: number
  columns: Array<{ name: string; type: string; sample: string }>
  preview: any[]
  aiAnalysis?: AISchemaAnalysis
}

interface IngestJobOptions {
  delimiter: string
  header: boolean
  encoding: string
  dateColumns: string[]
  quoteChar: string
  skipRows: number
}

interface CreateIngestJobFormData {
  name: string
  description: string
  sourceType: 'upload' | 's3' | 'local'
  sourcePath: string
  fileFormat: 'csv' | 'parquet' | 'json'
  options: IngestJobOptions
  targetTable: string
  environment: 'dev' | 'qa' | 'uat' | 'prod'
}

interface CreateIngestJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pipelineId: string
  onSuccess?: () => void
}

const defaultFormData: CreateIngestJobFormData = {
  name: '',
  description: '',
  sourceType: 'upload',
  sourcePath: '',
  fileFormat: 'csv',
  options: {
    delimiter: ',',
    header: true,
    encoding: 'utf-8',
    dateColumns: [],
    quoteChar: '"',
    skipRows: 0
  },
  targetTable: '',
  environment: 'dev'
}

export function CreateIngestJobModal({
  open,
  onOpenChange,
  pipelineId,
  onSuccess
}: CreateIngestJobModalProps) {
  const { toast } = useToast()
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<Record<keyof CreateIngestJobFormData, string>>>({})
  const [formData, setFormData] = React.useState<CreateIngestJobFormData>(defaultFormData)
  const [uploadedFile, setUploadedFile] = React.useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = React.useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadResult, setUploadResult] = React.useState<UploadResult | null>(null)
  const [showSchemaDetails, setShowSchemaDetails] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Reset form when modal opens
  React.useEffect(() => {
    if (open) {
      setFormData(defaultFormData)
      setErrors({})
      setUploadedFile(null)
      setUploadStatus('idle')
      setUploadResult(null)
      setShowSchemaDetails(false)
    }
  }, [open])

  // Auto-generate target table name from job name
  React.useEffect(() => {
    if (formData.name && !formData.targetTable) {
      const tableName = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
      setFormData(prev => ({ ...prev, targetTable: `${tableName}_bronze` }))
    }
  }, [formData.name])

  const updateField = <K extends keyof CreateIngestJobFormData>(
    field: K,
    value: CreateIngestJobFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const updateOption = <K extends keyof IngestJobOptions>(
    field: K,
    value: IngestJobOptions[K]
  ) => {
    setFormData(prev => ({
      ...prev,
      options: { ...prev.options, [field]: value }
    }))
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadedFile(file)

    // Detect file format from extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext === 'csv') {
      updateField('fileFormat', 'csv')
    } else if (ext === 'parquet') {
      updateField('fileFormat', 'parquet')
    } else if (ext === 'json') {
      updateField('fileFormat', 'json')
    }

    // Auto-fill name from filename if empty
    if (!formData.name) {
      const baseName = file.name.replace(/\.[^/.]+$/, '')
      updateField('name', baseName)
    }

    // Upload file to MinIO storage
    setUploadStatus('uploading')

    try {
      // Use the job name or derive source name from filename
      const sourceName = formData.name || file.name.replace(/\.[^/.]+$/, '')

      const formDataUpload = new FormData()
      formDataUpload.append('file', file)
      formDataUpload.append('sourceName', sourceName)
      // Include pipelineId for context
      formDataUpload.append('workflowId', pipelineId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result: UploadResult = await response.json()

      // Store the upload result for schema display
      setUploadResult(result)

      // Store the S3 URI as the source path
      updateField('sourcePath', result.landingKey || result.filepath)
      setUploadStatus('success')

      // Auto-expand schema if AI analysis is available
      if (result.aiAnalysis) {
        setShowSchemaDetails(true)
      }

      toast({
        type: 'success',
        title: 'File Uploaded & Analyzed',
        description: `${file.name} - ${result.rowCount} rows, ${result.columnCount} columns detected`
      })
    } catch (error) {
      setUploadStatus('error')
      toast({
        type: 'error',
        title: 'Upload Failed',
        description: error instanceof Error ? error.message : 'Failed to upload file'
      })
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateIngestJobFormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Job name is required'
    }

    if (formData.sourceType === 'upload' && !uploadedFile) {
      newErrors.sourcePath = 'Please select a file to upload'
    }

    if (formData.sourceType !== 'upload' && !formData.sourcePath.trim()) {
      newErrors.sourcePath = 'Source path is required'
    }

    if (!formData.targetTable.trim()) {
      newErrors.targetTable = 'Target table name is required'
    } else if (!/^[a-z][a-z0-9_]*$/.test(formData.targetTable)) {
      newErrors.targetTable = 'Table name must start with a letter and contain only lowercase letters, numbers, and underscores'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    setLoading(true)

    try {
      // Build detected schema from upload result for storage
      const detectedSchema = uploadResult?.aiAnalysis?.enhancedSchema
        ? uploadResult.aiAnalysis.enhancedSchema.map(col => ({
            name: col.name,
            type: col.detectedType,
            semanticType: col.semanticType,
            description: col.description
          }))
        : uploadResult?.columns?.map(col => ({
            name: col.name,
            type: col.type
          }))

      const response = await fetch(`/api/workflows/${pipelineId}/ingest-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          sourceType: formData.sourceType,
          sourcePath: formData.sourcePath,
          fileFormat: formData.fileFormat,
          options: formData.options,
          targetTable: formData.targetTable,
          environment: formData.environment,
          detectedSchema: detectedSchema
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create Ingest Job')
      }

      toast({
        type: 'success',
        title: 'Ingest Job Created',
        description: `"${formData.name}" has been added to the pipeline`
      })

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast({
        type: 'error',
        title: 'Creation Failed',
        description: error instanceof Error ? error.message : 'Failed to create Ingest Job'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="w-5 h-5 text-accent-orange" />
            Create Ingest Job
            <Badge variant="outline" className="text-xs border-accent-orange/30 text-accent-orange">
              Ingest · Landing → Bronze
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Create a new ingest job to load data from files into the Bronze layer
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

            <FormField>
              <FormLabel htmlFor="name">Job Name *</FormLabel>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g., Customer Data Import"
              />
              <FormError>{errors.name}</FormError>
            </FormField>

            <FormField>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe what this ingest job does..."
                rows={2}
              />
            </FormField>
          </div>

          {/* Source Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Source Configuration</h3>

            <FormField>
              <FormLabel>Source Type</FormLabel>
              <div className="grid grid-cols-3 gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => updateField('sourceType', 'upload')}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                    formData.sourceType === 'upload'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Upload className={`w-6 h-6 mb-2 ${formData.sourceType === 'upload' ? 'text-primary' : 'text-foreground-muted'}`} />
                  <span className="text-sm font-medium">File Upload</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateField('sourceType', 's3')}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                    formData.sourceType === 's3'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Cloud className={`w-6 h-6 mb-2 ${formData.sourceType === 's3' ? 'text-primary' : 'text-foreground-muted'}`} />
                  <span className="text-sm font-medium">S3 / MinIO</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateField('sourceType', 'local')}
                  className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${
                    formData.sourceType === 'local'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <HardDrive className={`w-6 h-6 mb-2 ${formData.sourceType === 'local' ? 'text-primary' : 'text-foreground-muted'}`} />
                  <span className="text-sm font-medium">Local Path</span>
                </button>
              </div>
            </FormField>

            {/* File Upload */}
            {formData.sourceType === 'upload' && (
              <FormField>
                <FormLabel>Select File *</FormLabel>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    uploadedFile ? 'border-green-300 bg-green-50' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.parquet,.json"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {uploadedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      {uploadStatus === 'uploading' && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
                      {uploadStatus === 'success' && <CheckCircle className="w-5 h-5 text-green-500" />}
                      {uploadStatus === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                      <FileText className="w-5 h-5 text-foreground-muted" />
                      <span className="font-medium">{uploadedFile.name}</span>
                      <span className="text-foreground-muted">
                        ({(uploadedFile.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mx-auto mb-2 text-foreground-muted" />
                      <p className="text-sm text-foreground-muted">
                        Click to select a file or drag and drop
                      </p>
                      <p className="text-xs text-foreground-muted mt-1">
                        Supports CSV, Parquet, JSON
                      </p>
                    </>
                  )}
                </div>
                <FormError>{errors.sourcePath}</FormError>
              </FormField>
            )}

            {/* AI Schema Detection Results */}
            {uploadResult && uploadStatus === 'success' && (
              <div className="border rounded-lg overflow-hidden bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                {/* Summary Header */}
                <div
                  className="p-4 cursor-pointer hover:bg-white/50 dark:hover:bg-black/10 transition-colors"
                  onClick={() => setShowSchemaDetails(!showSchemaDetails)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br from-purple-500 to-blue-500 text-white">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground flex items-center gap-2">
                          AI Schema Detection
                          {uploadResult.aiAnalysis?.suggestions?.qualityScore && (
                            <Badge
                              variant={
                                uploadResult.aiAnalysis.suggestions.qualityScore >= 80 ? 'success' :
                                uploadResult.aiAnalysis.suggestions.qualityScore >= 60 ? 'warning' : 'destructive'
                              }
                              className="text-xs"
                            >
                              Quality: {uploadResult.aiAnalysis.suggestions.qualityScore}%
                            </Badge>
                          )}
                        </h4>
                        <p className="text-sm text-foreground-muted">
                          {uploadResult.rowCount.toLocaleString()} rows, {uploadResult.columnCount} columns detected
                        </p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="gap-1">
                      {showSchemaDetails ? (
                        <>Hide Details <ChevronUp className="w-4 h-4" /></>
                      ) : (
                        <>Show Details <ChevronDown className="w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded Details */}
                {showSchemaDetails && (
                  <div className="border-t bg-white/50 dark:bg-black/10 p-4 space-y-4">
                    {/* Column Schema Table */}
                    <div>
                      <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                        <Table className="w-4 h-4" />
                        Detected Schema
                      </h5>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 px-2 font-medium text-foreground-muted">Column</th>
                              <th className="text-left py-2 px-2 font-medium text-foreground-muted">Type</th>
                              <th className="text-left py-2 px-2 font-medium text-foreground-muted">Semantic</th>
                              <th className="text-left py-2 px-2 font-medium text-foreground-muted">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(uploadResult.aiAnalysis?.enhancedSchema || uploadResult.columns).map((col, i) => {
                              const enhanced = col as AIEnhancedColumn
                              const basic = col as { name: string; type: string; sample: string }
                              return (
                                <tr key={i} className="border-b last:border-0 hover:bg-white/50 dark:hover:bg-black/10">
                                  <td className="py-2 px-2 font-mono font-medium">{enhanced.name || basic.name}</td>
                                  <td className="py-2 px-2">
                                    <Badge variant="outline" className="text-xs">
                                      {enhanced.detectedType || basic.type}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-2 text-foreground-muted">
                                    {enhanced.semanticType || '-'}
                                  </td>
                                  <td className="py-2 px-2 text-foreground-muted max-w-[200px] truncate">
                                    {enhanced.description || enhanced.businessMeaning || basic.sample || '-'}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* AI Insights */}
                    {uploadResult.aiAnalysis?.suggestions?.insights && uploadResult.aiAnalysis.suggestions.insights.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Lightbulb className="w-4 h-4 text-yellow-500" />
                          AI Insights
                        </h5>
                        <ul className="space-y-1">
                          {uploadResult.aiAnalysis.suggestions.insights.map((insight, i) => (
                            <li key={i} className="text-xs text-foreground-muted flex items-start gap-2">
                              <span className="text-purple-500 mt-0.5">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Data Quality Suggestions */}
                    {uploadResult.aiAnalysis?.suggestions?.dataQuality && uploadResult.aiAnalysis.suggestions.dataQuality.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          Data Quality Notes
                        </h5>
                        <div className="space-y-2">
                          {uploadResult.aiAnalysis.suggestions.dataQuality.slice(0, 3).map((issue, i) => (
                            <div
                              key={i}
                              className={`text-xs p-2 rounded flex items-start gap-2 ${
                                issue.severity === 'error' ? 'bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400' :
                                issue.severity === 'warning' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' :
                                'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
                              }`}
                            >
                              {issue.severity === 'error' ? (
                                <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              ) : issue.severity === 'warning' ? (
                                <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              ) : (
                                <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                              )}
                              <span>
                                {issue.column && <span className="font-medium">{issue.column}: </span>}
                                {issue.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Sample Data Preview */}
                    {uploadResult.preview && uploadResult.preview.length > 0 && (
                      <div>
                        <h5 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          Sample Data (first 3 rows)
                        </h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                {uploadResult.columns.slice(0, 5).map((col, i) => (
                                  <th key={i} className="text-left py-1 px-2 font-medium text-foreground-muted font-mono">
                                    {col.name}
                                  </th>
                                ))}
                                {uploadResult.columns.length > 5 && (
                                  <th className="text-left py-1 px-2 font-medium text-foreground-muted">...</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {uploadResult.preview.slice(0, 3).map((row, i) => (
                                <tr key={i} className="border-b last:border-0">
                                  {uploadResult.columns.slice(0, 5).map((col, j) => (
                                    <td key={j} className="py-1 px-2 text-foreground-muted max-w-[120px] truncate">
                                      {String(row[col.name] ?? '-')}
                                    </td>
                                  ))}
                                  {uploadResult.columns.length > 5 && (
                                    <td className="py-1 px-2 text-foreground-muted">...</td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* S3 / Local Path */}
            {formData.sourceType !== 'upload' && (
              <FormField>
                <FormLabel htmlFor="sourcePath">
                  {formData.sourceType === 's3' ? 'S3 URI *' : 'File Path *'}
                </FormLabel>
                <Input
                  id="sourcePath"
                  value={formData.sourcePath}
                  onChange={(e) => updateField('sourcePath', e.target.value)}
                  placeholder={
                    formData.sourceType === 's3'
                      ? 's3://bucket/path/to/file.csv'
                      : '/data/files/customers.csv'
                  }
                />
                <FormError>{errors.sourcePath}</FormError>
              </FormField>
            )}

            {/* File Format */}
            <FormField>
              <FormLabel>File Format</FormLabel>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {(['csv', 'parquet', 'json'] as const).map((format) => (
                  <button
                    key={format}
                    type="button"
                    onClick={() => updateField('fileFormat', format)}
                    className={`px-4 py-2 rounded-lg border-2 font-medium uppercase text-sm transition-all ${
                      formData.fileFormat === format
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
            </FormField>

            {/* CSV Options */}
            {formData.fileFormat === 'csv' && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-background-secondary rounded-lg">
                <FormField>
                  <FormLabel htmlFor="delimiter">Delimiter</FormLabel>
                  <Select
                    id="delimiter"
                    value={formData.options.delimiter}
                    onChange={(e) => updateOption('delimiter', e.target.value)}
                  >
                    <option value=",">Comma (,)</option>
                    <option value=";">Semicolon (;)</option>
                    <option value="\t">Tab</option>
                    <option value="|">Pipe (|)</option>
                  </Select>
                </FormField>

                <FormField>
                  <FormLabel htmlFor="header">Has Header Row</FormLabel>
                  <Select
                    id="header"
                    value={formData.options.header ? 'true' : 'false'}
                    onChange={(e) => updateOption('header', e.target.value === 'true')}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </Select>
                </FormField>

                <FormField>
                  <FormLabel htmlFor="encoding">Encoding</FormLabel>
                  <Select
                    id="encoding"
                    value={formData.options.encoding}
                    onChange={(e) => updateOption('encoding', e.target.value)}
                  >
                    <option value="utf-8">UTF-8</option>
                    <option value="latin-1">Latin-1</option>
                    <option value="utf-16">UTF-16</option>
                  </Select>
                </FormField>

                <FormField>
                  <FormLabel htmlFor="quoteChar">Quote Character</FormLabel>
                  <Select
                    id="quoteChar"
                    value={formData.options.quoteChar}
                    onChange={(e) => updateOption('quoteChar', e.target.value)}
                  >
                    <option value='"'>Double Quote (")</option>
                    <option value="'">Single Quote (')</option>
                    <option value="">None</option>
                  </Select>
                </FormField>
              </div>
            )}
          </div>

          {/* Target Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Target Configuration</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel htmlFor="targetTable">Bronze Table Name *</FormLabel>
                <Input
                  id="targetTable"
                  value={formData.targetTable}
                  onChange={(e) => updateField('targetTable', e.target.value.toLowerCase())}
                  placeholder="e.g., customers_bronze"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  <Info className="w-3 h-3 inline mr-1" />
                  Lowercase letters, numbers, and underscores only
                </p>
                <FormError>{errors.targetTable}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="environment">Environment</FormLabel>
                <Select
                  id="environment"
                  value={formData.environment}
                  onChange={(e) => updateField('environment', e.target.value as any)}
                >
                  <option value="dev">Development</option>
                  <option value="qa">QA</option>
                  <option value="uat">UAT</option>
                  <option value="prod">Production</option>
                </Select>
              </FormField>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Ingest Job'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
