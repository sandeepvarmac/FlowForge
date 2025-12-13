'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { StorageConnection, StorageFile } from '@/types/storage-connection'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, CheckCircle2, Upload, Settings, Shield, AlertCircle, Eye, HardDrive, Sparkles, Activity, Clock, Key, Mail, Phone, Globe, RefreshCw, Layers, FolderOpen, Server, Folder, Link2, BarChart3, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSVFileUpload } from './csv-file-upload'
import { DatabaseSourceConfig } from './database-source-config'
import { CreateConnectionModal } from '@/components/database'
import { DatabaseConnection } from '@/types/database-connection'
import { AISuggestionCard, AISuggestion } from '@/components/ai/ai-suggestion-card'
import { FullAnalysisModal } from '@/components/ai'
import { AIFullAnalysisResult } from '@/types/workflow'
import { useToast } from '@/hooks/use-toast'
import { ToastContainer } from '@/components/ui/toast-container'
import { trackAISuggestionsFetched, trackAISuggestionsApplied, trackAIError, trackAISuggestionExpanded } from '@/lib/telemetry'
import { useFeatureFlags } from '@/lib/config/feature-flags'

interface CreateJobModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onJobCreate: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>, uploadedFile?: File) => void
  mode?: 'create' | 'edit'
  editingJob?: Job | null
  cloningJob?: Job | null
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
  _detectedMetadata?: {
    temporal_columns?: string[]
    pk_candidates?: string[]
    // Enhanced AI Schema Intelligence fields
    foreign_keys?: Array<{ column: string; referencesTable: string }>
    measure_columns?: string[]
    dimension_columns?: string[]
    table_type?: 'fact' | 'dimension' | 'transactional' | 'reference'
    suggested_table_name?: string
    summary?: string
    data_quality_hints?: string[]
    ai_provider?: 'anthropic' | 'openai' | 'mock'
    ai_analyzed?: boolean
  }
  // AI-suggested quality rules storage
  _bronzeQualityRulesSuggestions?: any[]
  _silverQualityRulesApplied?: boolean
  _silverQualityRulesSuggestions?: any[]
  // AI-suggested Gold layer configurations
  _goldAggregationMetrics?: any[]
  _goldIndexingSuggestions?: {
    enabled: boolean
    strategy: string
    columns: string[]
  }
  // AI usage tracking for Review Step
  _aiUsageMetadata?: {
    bronze?: {
      applied: boolean
      suggestionsCount: number
      appliedCount: number
      confidence: number
    }
    silver?: {
      applied: boolean
      suggestionsCount: number
      appliedCount: number
      confidence: number
    }
    gold?: {
      applied: boolean
      suggestionsCount: number
      appliedCount: number
      confidence: number
    }
  }
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
    },
    databaseConfig: {
      tableName: '',
      isIncremental: false,
      deltaColumn: '',
      lastWatermark: ''
    }
  },
  destinationConfig: {
    landingZoneConfig: {
      enabled: true,
      pathPattern: '/landing/{source_name}/{date:yyyy/MM/dd}/',
      fileOrganization: 'date-partitioned' as 'date-partitioned' | 'source-partitioned' | 'flat',
      retentionDays: 30,
      immutable: false
    },
    bronzeConfig: {
      enabled: true,
      tableName: '',
      storageFormat: 'parquet',
      loadStrategy: 'append',
      loadMode: 'append' as 'overwrite' | 'append',
      auditColumns: true,
      auditColumnsBatchId: false,
      auditColumnsSourceSystem: false,
      auditColumnsFileModified: false,
      compression: 'snappy',
      schemaEvolution: 'strict',
      quarantineEnabled: false,
      quarantineTableName: '',
      columnMapping: [] as Array<{
        sourceColumn: string
        targetColumn: string
        targetType: string
        exclude: boolean
      }>
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
      storageFormat: 'duckdb',
      buildStrategy: 'full_rebuild',
      materializationType: 'table',
      tableType: 'fact', // AI will suggest: 'dimension' or 'fact'
      compression: 'zstd',
      aggregationEnabled: false,
      denormalizationEnabled: false,
      exportEnabled: false
    }
  }
}

const steps = [
  { id: 1, title: 'Select Source', description: 'Choose data source and configure connection', icon: Upload },
  { id: 2, title: 'Load Strategy', description: 'Define extraction mode and incremental settings', icon: RefreshCw },
  { id: 3, title: 'Landing Zone', description: 'Configure raw file storage location', icon: FolderOpen },
  { id: 4, title: 'Bronze Layer', description: 'Configure raw data ingestion', icon: Layers },
  { id: 5, title: 'Silver Layer', description: 'Configure cleaned & validated data', icon: Shield },
  { id: 6, title: 'Gold Layer', description: 'Configure analytics-ready data', icon: Sparkles },
  { id: 7, title: 'Review & Create', description: 'Review configuration and create source', icon: CheckCircle }
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
    enabled: true,
    badge: null
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

export function CreateJobModal({ open, onOpenChange, workflowId, onJobCreate, mode = 'create', editingJob = null, cloningJob = null }: CreateJobModalProps) {
  const [currentStep, setCurrentStep] = React.useState(1)
  const [formData, setFormData] = React.useState<JobFormData>(initialFormData)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const csvUploadRef = React.useRef<{ reset: () => void }>(null)
  const [availableConnections, setAvailableConnections] = React.useState<DatabaseConnection[]>([])
  const [isCreatingConnection, setIsCreatingConnection] = React.useState(false)
  const [selectedConnectionId, setSelectedConnectionId] = React.useState<string | null>(null)
  const toast = useToast()
  const featureFlags = useFeatureFlags()

  // Storage connection state for file-based jobs
  const [storageConnections, setStorageConnections] = React.useState<StorageConnection[]>([])
  const [selectedStorageConnectionId, setSelectedStorageConnectionId] = React.useState<string | null>(null)
  const [fileSourceMode, setFileSourceMode] = React.useState<'upload' | 'storage'>('upload')
  const [storageFiles, setStorageFiles] = React.useState<StorageFile[]>([])
  const [isLoadingStorageFiles, setIsLoadingStorageFiles] = React.useState(false)
  const [selectedStorageFile, setSelectedStorageFile] = React.useState<StorageFile | null>(null)
  const [storageFilesPrefix, setStorageFilesPrefix] = React.useState('')
  const [isLoadingStoragePreview, setIsLoadingStoragePreview] = React.useState(false)
  const [showStoragePreview, setShowStoragePreview] = React.useState(false)
  const prevStorageConnectionIdRef = React.useRef<string | null>(null)

  // Unified AI Suggestions state
  const [fullAiAnalysis, setFullAiAnalysis] = React.useState<AIFullAnalysisResult | null>(null)
  const [isAnalyzingAI, setIsAnalyzingAI] = React.useState(false)
  const [aiAnalysisError, setAiAnalysisError] = React.useState<string | null>(null)
  const [aiAnalysisStage, setAiAnalysisStage] = React.useState<string>('')
  const [aiAnalysisProgress, setAiAnalysisProgress] = React.useState(0)
  const [showAIModal, setShowAIModal] = React.useState(false)
  const [businessContext, setBusinessContext] = React.useState<string>('')

  // Legacy AI state (kept for backward compatibility with old cards if needed)
  const [aiSuggestions, setAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = React.useState(false)
  const [aiSuggestionsError, setAiSuggestionsError] = React.useState<string | null>(null)
  const [aiSuggestionsExpanded, setAiSuggestionsExpanded] = React.useState(false)
  const [usingFallbackBronze, setUsingFallbackBronze] = React.useState(false)

  const [silverAiSuggestions, setSilverAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingSilverAiSuggestions, setIsLoadingSilverAiSuggestions] = React.useState(false)
  const [silverAiSuggestionsError, setSilverAiSuggestionsError] = React.useState<string | null>(null)
  const [silverAiSuggestionsExpanded, setSilverAiSuggestionsExpanded] = React.useState(false)
  const [usingFallbackSilver, setUsingFallbackSilver] = React.useState(false)

  const [goldAiSuggestions, setGoldAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingGoldAiSuggestions, setIsLoadingGoldAiSuggestions] = React.useState(false)
  const [goldAiSuggestionsError, setGoldAiSuggestionsError] = React.useState<string | null>(null)
  const [goldAiSuggestionsExpanded, setGoldAiSuggestionsExpanded] = React.useState(false)
  const [usingFallbackGold, setUsingFallbackGold] = React.useState(false)

  // AI Schema Intelligence state
  const [isLoadingSchemaIntelligence, setIsLoadingSchemaIntelligence] = React.useState(false)
  const [schemaIntelligenceError, setSchemaIntelligenceError] = React.useState<string | null>(null)
  const [schemaIntelligenceStage, setSchemaIntelligenceStage] = React.useState<string>('')
  const [schemaIntelligenceProgress, setSchemaIntelligenceProgress] = React.useState(0)

  // AI Data Architect Review state
  interface AIArchitectReview {
    riskFlags: Array<{
      severity: 'high' | 'medium' | 'low'
      category: string
      message: string
      recommendation: string
    }>
    bronzeRecommendations: Array<{
      field: string
      currentValue: any
      suggestedValue: any
      reasoning: string
      applied?: boolean
    }>
    silverRecommendations: Array<{
      field: string
      currentValue: any
      suggestedValue: any
      reasoning: string
      applied?: boolean
    }>
    goldRecommendations: Array<{
      field: string
      currentValue: any
      suggestedValue: any
      reasoning: string
      applied?: boolean
    }>
    overallScore: number
    summary: string
  }
  const [aiArchitectReview, setAiArchitectReview] = React.useState<AIArchitectReview | null>(null)
  const [isLoadingAiReview, setIsLoadingAiReview] = React.useState(false)
  const [aiReviewError, setAiReviewError] = React.useState<string | null>(null)

  const resetForm = React.useCallback(() => {
    setFormData(initialFormData)
    setCurrentStep(1)
    setErrors({})
    csvUploadRef.current?.reset()

    // Reset AI analysis state
    setFullAiAnalysis(null)
    setIsAnalyzingAI(false)
    setAiAnalysisError(null)
    setShowAIModal(false)
    setBusinessContext('')

    // Reset legacy AI state
    setAiSuggestions(null)
    setSilverAiSuggestions(null)
    setGoldAiSuggestions(null)
    setSelectedConnectionId(null)

    // Reset AI Architect Review state
    setAiArchitectReview(null)
    setIsLoadingAiReview(false)
    setAiReviewError(null)

    // Reset storage connection state
    setSelectedStorageConnectionId(null)
    setFileSourceMode('upload')
    setStorageFiles([])
    setSelectedStorageFile(null)
    setStorageFilesPrefix('')
  }, [])

  // Populate form data when editing or cloning
  React.useEffect(() => {
    if (mode === 'edit' && editingJob && open) {
      // Reconstruct _detectedSchema from stored columnMapping if available
      const columnMapping = (editingJob.destinationConfig?.bronzeConfig as any)?.columnMapping as Array<{
        sourceColumn: string
        targetColumn: string
        targetType: string
        exclude: boolean
      }> | undefined

      const detectedSchema = columnMapping?.length
        ? columnMapping.map(col => ({
            name: col.sourceColumn,
            type: col.targetType || 'String',
            sample: undefined
          }))
        : undefined

      setFormData({
        name: editingJob.name,
        description: editingJob.description || '',
        type: editingJob.type,
        order: editingJob.order,
        sourceConfig: editingJob.sourceConfig,
        destinationConfig: editingJob.destinationConfig,
        transformationConfig: editingJob.transformationConfig,
        validationConfig: editingJob.validationConfig,
        // Reconstruct transient fields from stored data
        _detectedSchema: detectedSchema,
      })

      // Restore database connection selection if editing a database source
      if (editingJob.type === 'database') {
        // Check if connectionId was stored in sourceConfig
        const storedConnectionId = (editingJob.sourceConfig as any)?.connectionId
        if (storedConnectionId) {
          setSelectedConnectionId(storedConnectionId)
        }
      }

      // Restore storage connection selection if editing a file-based source with storage
      if (editingJob.type === 'file-based') {
        const storedStorageConnectionId = editingJob.sourceConfig?.fileConfig?.storageConnectionId
        if (storedStorageConnectionId) {
          setSelectedStorageConnectionId(storedStorageConnectionId)
          setFileSourceMode('storage')
        }
      }

      setCurrentStep(1)
    } else if (cloningJob && open) {
      // When cloning, pre-fill data with modified name
      const clonedName = `${cloningJob.name} (Copy)`

      // Also reconstruct schema for cloning
      const columnMapping = (cloningJob.destinationConfig?.bronzeConfig as any)?.columnMapping as Array<{
        sourceColumn: string
        targetColumn: string
        targetType: string
        exclude: boolean
      }> | undefined

      const detectedSchema = columnMapping?.length
        ? columnMapping.map(col => ({
            name: col.sourceColumn,
            type: col.targetType || 'String',
            sample: undefined
          }))
        : undefined

      setFormData({
        name: clonedName,
        description: cloningJob.description || '',
        type: cloningJob.type,
        order: cloningJob.order + 1, // Increment order for the clone
        sourceConfig: cloningJob.sourceConfig,
        destinationConfig: cloningJob.destinationConfig,
        transformationConfig: cloningJob.transformationConfig,
        validationConfig: cloningJob.validationConfig,
        _detectedSchema: detectedSchema,
      })
      setCurrentStep(1)
    } else if (mode === 'create' && !cloningJob && open) {
      resetForm()
    }
  }, [mode, editingJob, cloningJob, open, resetForm])

  const updateFormData = (updates: Partial<JobFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  // Fetch available connections when modal opens and job type is database
  React.useEffect(() => {
    if (open && formData.type === 'database') {
      fetchConnections()
    }
  }, [open, formData.type])

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/database-connections')
      const data = await response.json()
      if (data.success) {
        setAvailableConnections(data.connections)
      }
    } catch (error) {
      console.error('Failed to fetch connections:', error)
    }
  }

  // Reset storage state when modal opens in create mode
  React.useEffect(() => {
    if (open && mode === 'create' && !cloningJob) {
      // Ensure storage state is fully reset
      setSelectedStorageConnectionId(null)
      setFileSourceMode('upload')
      setStorageFiles([])
      setSelectedStorageFile(null)
      setStorageFilesPrefix('')
      prevStorageConnectionIdRef.current = null
    }
  }, [open, mode, cloningJob])

  // Fetch storage connections when modal opens and job type is file-based
  React.useEffect(() => {
    if (open && formData.type === 'file-based') {
      fetchStorageConnections()
    }
  }, [open, formData.type])

  const fetchStorageConnections = async () => {
    try {
      const response = await fetch('/api/storage-connections')
      const data = await response.json()
      if (data.success) {
        setStorageConnections(data.connections)
      }
    } catch (error) {
      console.error('Failed to fetch storage connections:', error)
    }
  }

  // Fetch files from selected storage connection
  const fetchStorageFiles = async (connectionId: string, prefix: string = '') => {
    setIsLoadingStorageFiles(true)
    try {
      const params = new URLSearchParams()
      if (prefix) params.append('prefix', prefix)
      params.append('pattern', '*.csv,*.json,*.parquet,*.xlsx')

      const response = await fetch(`/api/storage-connections/${connectionId}/files?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setStorageFiles(data.files)
      } else {
        toast.error(`Failed to list files: ${data.error || 'Unknown error'}`)
        setStorageFiles([])
      }
    } catch (error) {
      console.error('Failed to fetch storage files:', error)
      toast.error('Failed to list files: Could not connect to storage')
      setStorageFiles([])
    } finally {
      setIsLoadingStorageFiles(false)
    }
  }

  // Fetch file preview (schema + sample data) from storage connection
  const fetchStorageFilePreview = async (connectionId: string, filePath: string, file: StorageFile) => {
    setIsLoadingStoragePreview(true)
    try {
      const response = await fetch(`/api/storage-connections/${connectionId}/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, maxRows: 100 })
      })
      const data = await response.json()

      if (data.success) {
        // Auto-generate table names from filename
        const cleanName = file.name
          .replace(/\.[^/.]+$/, '') // Remove extension
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_') // Replace special chars with underscore

        // Update form data with schema, preview, and metadata (same as CSV upload)
        setFormData(prev => ({
          ...prev,
          name: prev.name || file.name.replace(/\.[^/.]+$/, ''),
          _detectedSchema: data.schema,
          _previewData: data.preview,
          _detectedMetadata: data.metadata,
          sourceConfig: {
            ...prev.sourceConfig,
            fileConfig: {
              ...prev.sourceConfig.fileConfig!,
              filePath: filePath,
              storageConnectionId: connectionId,
              hasHeader: data.metadata?.hasHeader ?? true
            }
          },
          // Auto-populate destination table names
          destinationConfig: {
            ...prev.destinationConfig,
            bronzeConfig: {
              ...prev.destinationConfig.bronzeConfig!,
              tableName: prev.destinationConfig.bronzeConfig?.tableName || `${cleanName}_bronze`
            },
            silverConfig: {
              ...prev.destinationConfig.silverConfig!,
              tableName: prev.destinationConfig.silverConfig?.tableName || `${cleanName}_silver`
            },
            goldConfig: {
              ...prev.destinationConfig.goldConfig!,
              tableName: prev.destinationConfig.goldConfig?.tableName || `${cleanName}_gold`
            }
          }
        } as any))

        // Trigger AI Schema Intelligence analysis (same as CSV upload)
        if (data.schema && data.schema.length > 0) {
          fetchSchemaIntelligence(data.schema, data.preview, file.name, data.preview?.length)
        }

        toast.success(`File loaded - Schema detected with ${data.schema?.length || 0} columns`)
      } else {
        toast.error(`Failed to load file: ${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to fetch storage file preview:', error)
      toast.error('Failed to load file: Could not read file from storage')
    } finally {
      setIsLoadingStoragePreview(false)
    }
  }

  // Reset storage files and prefix when connection changes
  React.useEffect(() => {
    if (selectedStorageConnectionId !== prevStorageConnectionIdRef.current) {
      // Connection changed - reset the prefix to root
      if (prevStorageConnectionIdRef.current !== null) {
        setStorageFilesPrefix('')
        setStorageFiles([])
        setSelectedStorageFile(null)
      }
      prevStorageConnectionIdRef.current = selectedStorageConnectionId
    }
  }, [selectedStorageConnectionId])

  // When storage connection is selected or prefix changes, fetch files
  React.useEffect(() => {
    if (selectedStorageConnectionId && fileSourceMode === 'storage') {
      fetchStorageFiles(selectedStorageConnectionId, storageFilesPrefix)
    }
  }, [selectedStorageConnectionId, fileSourceMode, storageFilesPrefix])

  const fetchNextOrder = React.useCallback(async () => {
    if (mode === 'edit') return
    try {
      const response = await fetch(`/api/workflows/${workflowId}`)
      if (!response.ok) return
      const data = await response.json()
      const jobs = data.workflow?.jobs || []
      const maxOrder = jobs.reduce((max: number, job: Job) => Math.max(max, job.order ?? 0), 0)
      const nextOrder = maxOrder + 1 || 1
      setFormData(prev => ({ ...prev, order: nextOrder }))
    } catch (error) {
      console.error('Failed to fetch next job order:', error)
    }
  }, [workflowId, mode])

  React.useEffect(() => {
    if (open && mode !== 'edit') {
      fetchNextOrder()
    }
  }, [open, mode, fetchNextOrder])

  const handleConnectionSelect = (connectionId: string) => {
    const connection = availableConnections.find(c => c.id === connectionId)
    if (connection) {
      setSelectedConnectionId(connectionId)
      updateSourceConfig({
        type: connection.type,
        connectionId: connectionId, // Store connectionId for edit restoration
        connection: {
          host: connection.host,
          port: connection.port,
          database: connection.database,
          username: connection.username,
          password: connection.password
        }
      })
    }
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

  // NEW: Unified Full AI Analysis Function
  const fetchFullAIAnalysis = React.useCallback(async () => {
    console.log('[AI Full] ===== fetchFullAIAnalysis CALLED =====')

    // Determine source type
    const isDatabaseSource = formData.type === 'database'
    const isFileSource = formData.type === 'file-based' || formData.type === 'api' || formData.type === 'nosql'

    console.log('[AI Full] Source type check:', { type: formData.type, isDatabaseSource, isFileSource })

    let requestBody: any = {}

    if (isDatabaseSource) {
      const useTableName = formData.sourceConfig.databaseConfig?.tableName
      const useConnectionId = selectedConnectionId
      const useDbType = formData.sourceConfig.type

      if (!useTableName || !useConnectionId || !useDbType) {
        console.log('[AI Full] Missing required database data:', { useTableName, useConnectionId, useDbType })
        toast.error('Missing source configuration - Please complete the source configuration before requesting AI analysis')
        return
      }

      requestBody = {
        dbType: useDbType,
        connectionId: useConnectionId,
        tableName: useTableName,
        businessContext: businessContext || undefined
      }
    } else if (isFileSource) {
      const schema = formData._detectedSchema
      const sampleData = formData._previewData

      if (!schema || !sampleData || sampleData.length === 0) {
        console.log('[AI Full] Missing schema or sample data')
        toast.error('No data to analyze - Please upload a file or select one from storage first')
        return
      }

      requestBody = {
        sourceType: formData.type === 'file-based' ? 'file' : formData.type,
        tableName: formData.sourceConfig.fileConfig?.filePath || 'uploaded_file',
        schema: schema,
        sampleData: sampleData,
        businessContext: businessContext || undefined
      }
    } else {
      console.log('[AI Full] Unsupported source type:', formData.type)
      return
    }

    console.log('[AI Full] Request body prepared:', { ...requestBody, sampleData: requestBody.sampleData ? `[${requestBody.sampleData.length} rows]` : undefined })

    // Progress stages for UI feedback
    const progressStages = [
      { progress: 10, stage: 'Preparing schema analysis...' },
      { progress: 25, stage: 'Analyzing column patterns...' },
      { progress: 40, stage: 'Identifying relationships...' },
      { progress: 55, stage: 'Generating Bronze layer config...' },
      { progress: 70, stage: 'Generating Silver layer config...' },
      { progress: 85, stage: 'Generating Gold layer config...' },
      { progress: 95, stage: 'Finalizing recommendations...' }
    ]

    let progressInterval: NodeJS.Timeout | null = null
    let currentStageIndex = 0

    try {
      console.log('[AI Full] Opening modal and starting analysis...')
      setIsAnalyzingAI(true)
      setAiAnalysisError(null)
      setShowAIModal(true)
      setAiAnalysisProgress(0)
      setAiAnalysisStage('Initializing AI analysis...')
      console.log('[AI Full] Modal state set to open, isAnalyzing: true')

      // Start progress animation
      progressInterval = setInterval(() => {
        if (currentStageIndex < progressStages.length) {
          const { progress, stage } = progressStages[currentStageIndex]
          setAiAnalysisProgress(progress)
          setAiAnalysisStage(stage)
          currentStageIndex++
        }
      }, 1500)

      const response = await fetch('/api/ai/config/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      // Complete progress on success
      if (progressInterval) clearInterval(progressInterval)
      setAiAnalysisProgress(100)
      setAiAnalysisStage('Analysis complete!')

      console.log('[AI Full] Response received:', { success: data.success, providerUsed: data.providerUsed })

      if (data.success) {
        setFullAiAnalysis(data)
        trackAISuggestionsFetched({
          layer: 'bronze',
          tableName: formData.sourceConfig.databaseConfig?.tableName || formData._uploadedFile?.name || 'unknown',
          suggestionsCount: Object.keys(data.bronze || {}).length + Object.keys(data.silver || {}).length + Object.keys(data.gold || {}).length,
          usingFallback: data.providerUsed === 'openai'
        })
      } else {
        setAiAnalysisError(data.message || 'Failed to generate AI analysis')
        trackAIError({
          layer: 'bronze',
          errorMessage: data.message || 'Unknown error'
        })
        toast.error(`AI Analysis Failed - ${data.message || 'Failed to generate recommendations'}`)
      }
    } catch (error) {
      console.error('[AI Full] Error:', error)
      if (progressInterval) clearInterval(progressInterval)
      setAiAnalysisProgress(0)
      setAiAnalysisStage('')
      setAiAnalysisError(error instanceof Error ? error.message : 'Network error')
      trackAIError({
        layer: 'bronze',
        errorMessage: error instanceof Error ? error.message : 'Network error'
      })
      toast.error('AI Analysis Failed - Unable to connect to AI service')
    } finally {
      setIsAnalyzingAI(false)
    }
  }, [formData, selectedConnectionId, businessContext, toast])

  // Handle Accept All AI Recommendations
  const handleAcceptAIRecommendations = React.useCallback(() => {
    if (!fullAiAnalysis?.success) return

    console.log('[AI Full] Accepting all AI recommendations')

    const { bronze, silver, gold, providerUsed } = fullAiAnalysis

    // Apply all AI suggestions in a single setFormData to preserve existing values
    setFormData(prev => {
      const bronzeUpdates: any = {}
      const silverUpdates: any = {}
      const goldUpdates: any = {}
      let sourceConfigUpdates: any = null
      let goldAggregationMetrics: any[] = []

      // Build Bronze updates
      if (bronze) {
        if (bronze.incremental_load?.enabled) {
          bronzeUpdates.loadStrategy = bronze.incremental_load.strategy === 'incremental' ? 'incremental' : 'append'
          if (bronze.incremental_load.watermark_column) {
            sourceConfigUpdates = {
              databaseConfig: {
                ...prev.sourceConfig.databaseConfig,
                isIncremental: true,
                deltaColumn: bronze.incremental_load.watermark_column
              }
            }
          }
        }
        if (bronze.schema_evolution?.enabled) {
          bronzeUpdates.schemaEvolution = bronze.schema_evolution.mode || 'additive'
        }
      }

      // Build Silver updates
      if (silver) {
        if (silver.primary_key?.columns && silver.primary_key.columns.length > 0) {
          silverUpdates.primaryKey = silver.primary_key.columns.join(',')
        }
        if (silver.merge_strategy?.type) {
          silverUpdates.mergeStrategy = silver.merge_strategy.type
        }
        if (silver.deduplication?.enabled) {
          silverUpdates.deduplicationEnabled = true
        }
      }

      // Build Gold updates
      if (gold) {
        if (gold.aggregations?.recommended_dimensions && gold.aggregations.recommended_dimensions.length > 0) {
          goldUpdates.aggregationEnabled = true
          goldAggregationMetrics = gold.aggregations?.recommended_metrics || []
        }
      }

      return {
        ...prev,
        sourceConfig: sourceConfigUpdates
          ? { ...prev.sourceConfig, ...sourceConfigUpdates }
          : prev.sourceConfig,
        destinationConfig: {
          ...prev.destinationConfig,
          bronzeConfig: {
            ...prev.destinationConfig.bronzeConfig,
            ...bronzeUpdates
          },
          silverConfig: {
            ...prev.destinationConfig.silverConfig,
            ...silverUpdates
          },
          goldConfig: {
            ...prev.destinationConfig.goldConfig,
            ...goldUpdates
          }
        },
        _goldAggregationMetrics: goldAggregationMetrics.length > 0 ? goldAggregationMetrics : prev._goldAggregationMetrics
      } as any
    })

    // Update AI usage metadata
    setFormData(prev => ({
      ...prev,
      _aiUsageMetadata: {
        bronze: {
          applied: true,
          suggestionsCount: Object.keys(bronze || {}).length,
          appliedCount: Object.keys(bronze || {}).length,
          confidence: 0.9
        },
        silver: {
          applied: true,
          suggestionsCount: Object.keys(silver || {}).length,
          appliedCount: Object.keys(silver || {}).length,
          confidence: 0.9
        },
        gold: {
          applied: true,
          suggestionsCount: Object.keys(gold || {}).length,
          appliedCount: Object.keys(gold || {}).length,
          confidence: 0.9
        }
      }
    }))

    trackAISuggestionsApplied({
      layer: 'bronze',
      suggestionsAccepted: Object.keys(bronze || {}).length + Object.keys(silver || {}).length + Object.keys(gold || {}).length,
      suggestionsTotal: Object.keys(bronze || {}).length + Object.keys(silver || {}).length + Object.keys(gold || {}).length
    })
    toast.success('AI Recommendations Applied - All layer configurations have been pre-filled with AI suggestions', 4000)
    setShowAIModal(false)
  }, [fullAiAnalysis, toast, updateDestinationConfig])

  // Handle Discard AI Recommendations
  const handleDiscardAIRecommendations = React.useCallback(() => {
    console.log('[AI Full] Discarding AI recommendations')
    setFullAiAnalysis(null)
    setShowAIModal(false)
    toast.info('AI Recommendations Discarded - You can configure layers manually', 3000)
  }, [toast])

  // OLD: Fetch AI suggestions for Bronze layer configuration (no longer used)

  const fetchAiSuggestions = React.useCallback(async (_tableName?: string, _connectionId?: string, _dbType?: string) => {

    console.log('[AI] Legacy Bronze fetch disabled - unified AI analysis handles suggestions now')

  }, [])

  // Fetch AI Schema Intelligence
  const fetchSchemaIntelligence = React.useCallback(async (
    schema: Array<{ name: string; type: string; sample?: string }>,
    sampleData?: any[],
    fileName?: string,
    rowCount?: number
  ) => {
    setIsLoadingSchemaIntelligence(true)
    setSchemaIntelligenceError(null)
    setSchemaIntelligenceProgress(0)
    setSchemaIntelligenceStage('')

    // Progress stages for UI feedback
    const progressStages = [
      { progress: 10, stage: 'Preparing schema for analysis...' },
      { progress: 25, stage: 'Analyzing column patterns...' },
      { progress: 45, stage: 'Detecting primary keys...' },
      { progress: 60, stage: 'Identifying relationships...' },
      { progress: 75, stage: 'Classifying column roles...' },
      { progress: 90, stage: 'Finalizing insights...' }
    ]

    let progressInterval: NodeJS.Timeout | null = null
    let currentStageIndex = 0

    // Start progress animation
    progressInterval = setInterval(() => {
      if (currentStageIndex < progressStages.length) {
        const { progress, stage } = progressStages[currentStageIndex]
        setSchemaIntelligenceProgress(progress)
        setSchemaIntelligenceStage(stage)
        currentStageIndex++
      }
    }, 800)

    try {
      const response = await fetch('/api/ai/analyze-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schema,
          sampleData: sampleData?.slice(0, 10), // Limit sample data
          fileName,
          rowCount
        })
      })

      if (!response.ok) {
        throw new Error('Failed to analyze schema')
      }

      const result = await response.json()
      const analysis = result.analysis

      // Complete progress
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      setSchemaIntelligenceProgress(100)
      setSchemaIntelligenceStage('Analysis complete!')

      // Update metadata with AI analysis results
      setFormData(prev => ({
        ...prev,
        _detectedMetadata: {
          ...prev._detectedMetadata,
          pk_candidates: analysis.primaryKeys || [],
          temporal_columns: analysis.temporalColumns || [],
          foreign_keys: analysis.foreignKeys || [],
          measure_columns: analysis.measureColumns || [],
          dimension_columns: analysis.dimensionColumns || [],
          table_type: analysis.tableType,
          suggested_table_name: analysis.suggestedTableName,
          summary: analysis.summary,
          data_quality_hints: analysis.dataQualityHints || [],
          ai_provider: result.provider,
          ai_analyzed: true
        }
      }))

      console.log(`[Schema Intelligence] Analysis complete via ${result.provider}:`, analysis)
    } catch (error) {
      console.error('[Schema Intelligence] Error:', error)
      setSchemaIntelligenceError(error instanceof Error ? error.message : 'Failed to analyze schema')
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setIsLoadingSchemaIntelligence(false)
      setSchemaIntelligenceProgress(0)
      setSchemaIntelligenceStage('')
    }
  }, [])

  // Fetch Gold AI Suggestions
  const fetchGoldAiSuggestions = React.useCallback(async () => {
    console.log('[Gold AI] ===== fetchGoldAiSuggestions CALLED =====')

    // DEPRECATED: This function is replaced by unified fetchFullAIAnalysis
    // If unified analysis already exists, skip legacy Gold-only fetch
    if (fullAiAnalysis) {
      console.log('[Gold AI] Skipping legacy Gold fetch - unified analysis already available')
      return
    }

    // Determine if this is a database source or file/other source
    const isDatabaseSource = formData.type === 'database'
    const isFileSource = formData.type === 'file-based' || formData.type === 'api' || formData.type === 'nosql'

    console.log('[Gold AI] Source type check:', { type: formData.type, isDatabaseSource, isFileSource })

    let requestBody: any = {}

    if (isDatabaseSource) {
      // Database source - use existing logic
      const useTableName = formData.sourceConfig.databaseConfig?.tableName
      const useConnectionId = selectedConnectionId
      const useDbType = formData.sourceConfig.type

      if (!useTableName || !useConnectionId || !useDbType) {
        console.log('[Gold AI] Missing required database data:', { useTableName, useConnectionId, useDbType })
        return
      }

      console.log('[Gold AI] Fetching suggestions for database:', { useTableName, useConnectionId, useDbType, businessContext: businessContext || 'not provided' })

      requestBody = {
        dbType: useDbType,
        connectionId: useConnectionId,
        tableName: useTableName,
        businessContext: businessContext || null
      }
    } else if (isFileSource) {
      // File/Other source - use schema and sample data
      const schema = formData._detectedSchema
      const sampleData = formData._previewData
      const sourceName = formData.sourceConfig.fileConfig?.filePath?.split(/[/\\]/).pop() || formData.name || 'unknown_source'

      if (!schema || !sampleData || sampleData.length === 0) {
        console.log('[Gold AI] Missing required file data:', {
          hasSchema: !!schema,
          sampleDataRows: sampleData?.length || 0
        })
        return
      }

      console.log('[Gold AI] Fetching suggestions for file source:', {
        sourceType: formData.type,
        sourceName,
        schemaColumns: schema.length,
        sampleRows: sampleData.length,
        businessContext: businessContext || 'not provided'
      })

      requestBody = {
        sourceType: formData.type,
        tableName: sourceName,
        schema: schema,
        sampleData: sampleData,
        businessContext: businessContext || null
      }
    } else {
      console.log('[Gold AI] Unsupported source type:', formData.type)
      return
    }

    setIsLoadingGoldAiSuggestions(true)
    setGoldAiSuggestionsError(null)

    try {
      const response = await fetch('/api/ai/config/gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('[Gold AI] API response:', result)

      if (result.success && result.suggestions) {
        console.log('[Gold AI] Setting suggestions:', result.suggestions)
        // Extract fallback indicator before setting suggestions
        const usingFallback = result.suggestions._using_fallback || false
        setUsingFallbackGold(usingFallback)
        setGoldAiSuggestions(result.suggestions)
        setGoldAiSuggestionsError(null)
      } else {
        console.error('[Gold AI] API returned error:', result.message)
        let errorMessage = result.message || 'Failed to generate Gold layer suggestions'

        // Provide user-friendly error messages for common issues
        if (result.error && (
          result.error.includes('credit balance is too low') ||
          result.error.includes('insufficient credits') ||
          result.error.includes('BadRequestError')
        )) {
          errorMessage = 'AI service is temporarily unavailable due to API credits. Please contact your administrator or add credits to your Anthropic account.'
        }

        setGoldAiSuggestionsError(errorMessage)
      }
    } catch (error) {
      console.error('[Gold AI] Error fetching AI suggestions:', error)
      setGoldAiSuggestionsError('Failed to generate Gold AI suggestions. Please try again.')
    } finally {
      setIsLoadingGoldAiSuggestions(false)
    }
  }, [
    formData.type,
    formData.sourceConfig.databaseConfig?.tableName,
    formData.sourceConfig.fileConfig?.filePath,
    formData.name,
    formData._detectedSchema,
    formData._previewData,
    selectedConnectionId,
    businessContext,
    fullAiAnalysis
  ])

  // Apply AI suggestions to Bronze config
  const applyAiSuggestions = React.useCallback(() => {
    console.log('[AI] applyAiSuggestions called with:', aiSuggestions)
    if (!aiSuggestions) {
      console.log('[AI] No suggestions to apply')
      return
    }

    const bronzeUpdates: any = {}
    let appliedCount = 0

    // Apply storage format suggestion
    if (aiSuggestions.storage_format?.format) {
      bronzeUpdates.storageFormat = aiSuggestions.storage_format.format
      appliedCount++
    }

    // Apply compression suggestion
    if (aiSuggestions.compression?.algorithm) {
      bronzeUpdates.compression = aiSuggestions.compression.algorithm
      appliedCount++
    }

    // Apply incremental load suggestion
    if (aiSuggestions.incremental_load?.enabled) {
      bronzeUpdates.loadStrategy = 'incremental'
      // Store watermark column in database config
      if (aiSuggestions.incremental_load.watermark_column) {
        updateSourceConfig({
          databaseConfig: {
            ...formData.sourceConfig.databaseConfig!,
            deltaColumn: aiSuggestions.incremental_load.watermark_column,
            isIncremental: true
          }
        })
      }
      appliedCount++
    } else if (aiSuggestions.incremental_load?.enabled === false) {
      // If AI explicitly recommends full refresh, apply that
      bronzeUpdates.loadStrategy = 'full_refresh'
      appliedCount++
    }

    // Apply schema evolution suggestion
    if (aiSuggestions.schema_evolution?.enabled !== undefined) {
      bronzeUpdates.schemaEvolution = aiSuggestions.schema_evolution.enabled ? 'add_new_columns' : 'strict'
      appliedCount++
    }

    // Apply partitioning suggestion
    if (aiSuggestions.partitioning?.enabled && aiSuggestions.partitioning.partition_column) {
      // Store partition info - you may want to add UI fields for this in the future
      bronzeUpdates._partitionStrategy = aiSuggestions.partitioning.strategy
      bronzeUpdates._partitionColumn = aiSuggestions.partitioning.partition_column
      appliedCount++
    }

    // Update Bronze config with all AI suggestions
    updateDestinationConfig({
      bronzeConfig: {
        ...formData.destinationConfig.bronzeConfig!,
        ...bronzeUpdates
      }
    })

    // Show success toast notification
    toast.success(`Applied ${appliedCount} AI suggestions to Bronze layer configuration`, 4000)
    console.log('[AI] Applied', appliedCount, 'AI suggestions to Bronze layer:', bronzeUpdates)

    // Track telemetry
    const suggestionsTotal = Object.keys(aiSuggestions).filter(k => !k.startsWith('_')).length
    trackAISuggestionsApplied({
      layer: 'bronze',
      suggestionsAccepted: appliedCount,
      suggestionsTotal
    })

    // Calculate overall confidence for metadata
    const confidenceScores = Object.values(aiSuggestions)
      .filter((s: any) => s?.confidence)
      .map((s: any) => s.confidence)
    const overallConfidence = confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length)
      : 0

    // Store AI usage metadata for Review Step
    setFormData(prev => ({
      ...prev,
      _aiUsageMetadata: {
        ...prev._aiUsageMetadata,
        bronze: {
          applied: true,
          suggestionsCount: suggestionsTotal,
          appliedCount,
          confidence: overallConfidence
        }
      }
    }))

    // Collapse the AI suggestions card after applying
    setAiSuggestionsExpanded(false)
  }, [aiSuggestions, formData, updateSourceConfig, updateDestinationConfig, setAiSuggestionsExpanded, toast])

  // Reset Bronze config to manual defaults
  const resetToManualDefaults = React.useCallback(() => {
    const defaultBronzeConfig = {
      enabled: true,
      tableName: formData.destinationConfig.bronzeConfig?.tableName || '', // Keep table name
      storageFormat: 'parquet' as const,
      compression: 'snappy' as const,
      loadStrategy: 'append' as const,
      schemaEvolution: 'add_new_columns' as const,
      auditColumns: true,
      auditColumnsBatchId: true,
      auditColumnsSourceSystem: true,
      auditColumnsFileModified: false
    }

    updateDestinationConfig({
      bronzeConfig: defaultBronzeConfig
    })

    // Reset database config incremental settings
    if (formData.sourceConfig.databaseConfig) {
      updateSourceConfig({
        databaseConfig: {
          ...formData.sourceConfig.databaseConfig,
          isIncremental: false,
          deltaColumn: undefined
        }
      })
    }

    toast.info('Reset Bronze layer configuration to manual defaults', 3000)
    console.log('[AI] Reset to manual defaults')
  }, [formData, updateSourceConfig, updateDestinationConfig, toast])

  // Apply Silver AI suggestions to Silver config
  const applySilverAiSuggestions = React.useCallback(() => {
    console.log('[Silver AI] applySilverAiSuggestions called with:', silverAiSuggestions)
    if (!silverAiSuggestions) {
      console.log('[Silver AI] No suggestions to apply')
      return
    }

    const silverUpdates: any = {}
    let appliedCount = 0

    // Apply primary key suggestion
    if (silverAiSuggestions.primary_key?.columns && silverAiSuggestions.primary_key.columns.length > 0) {
      const columns = silverAiSuggestions.primary_key.columns
      silverUpdates.primaryKey = columns.length === 1 ? columns[0] : columns
      appliedCount++
    }

    // Apply merge strategy suggestion
    if (silverAiSuggestions.merge_strategy?.strategy) {
      silverUpdates.mergeStrategy = silverAiSuggestions.merge_strategy.strategy
      if (silverAiSuggestions.merge_strategy.update_strategy) {
        silverUpdates.updateStrategy = silverAiSuggestions.merge_strategy.update_strategy
      }
      if (silverAiSuggestions.merge_strategy.conflict_resolution) {
        silverUpdates.conflictResolution = silverAiSuggestions.merge_strategy.conflict_resolution
      }
      appliedCount++
    }

    // Apply deduplication suggestion
    if (silverAiSuggestions.deduplication?.enabled !== undefined) {
      // Store dedup info in a custom field for now (UI may not have direct toggle yet)
      silverUpdates._dedupEnabled = silverAiSuggestions.deduplication.enabled
      silverUpdates._dedupStrategy = silverAiSuggestions.deduplication.strategy
      silverUpdates._dedupSortColumn = silverAiSuggestions.deduplication.sort_column
      appliedCount++
    }

    // Quality rules are stored separately - we'll show them in a list for user to add manually
    // Store them in form data for reference
    if (silverAiSuggestions.quality_rules?.suggested_rules && silverAiSuggestions.quality_rules.suggested_rules.length > 0) {
      setFormData(prev => ({
        ...prev,
        _silverQualityRulesSuggestions: silverAiSuggestions.quality_rules.suggested_rules
      }))
      appliedCount++
    }

    // Update Silver config with all AI suggestions
    updateDestinationConfig({
      silverConfig: {
        ...formData.destinationConfig.silverConfig!,
        ...silverUpdates
      }
    })

    // Show success toast notification
    toast.success(`Applied ${appliedCount} AI suggestions to Silver layer configuration`, 4000)
    console.log('[Silver AI] Applied', appliedCount, 'AI suggestions to Silver layer:', silverUpdates)

    // Collapse the AI suggestions card after applying
    setSilverAiSuggestionsExpanded(false)
  }, [silverAiSuggestions, formData, updateDestinationConfig, setSilverAiSuggestionsExpanded, toast])

  // Apply Gold AI Suggestions
  const applyGoldAiSuggestions = React.useCallback(() => {
    console.log('[Gold AI] applyGoldAiSuggestions called with:', goldAiSuggestions)
    if (!goldAiSuggestions) {
      console.log('[Gold AI] No suggestions to apply')
      return
    }

    const goldUpdates: any = {}
    let appliedCount = 0

    // Apply aggregation suggestions
    if (goldAiSuggestions.aggregation?.enabled !== undefined) {
      goldUpdates.aggregationEnabled = goldAiSuggestions.aggregation.enabled

      if (goldAiSuggestions.aggregation.level) {
        // Map AI aggregation level to time grain
        const levelToGrain: Record<string, 'daily' | 'weekly' | 'monthly' | 'yearly'> = {
          'DAILY': 'daily',
          'MONTHLY': 'monthly',
          'YEARLY': 'yearly'
        }
        goldUpdates.aggregationTimeGrain = levelToGrain[goldAiSuggestions.aggregation.level] || 'daily'
      }

      // Store metrics for display/reference (may need custom UI to show suggested metrics)
      if (goldAiSuggestions.aggregation.metrics && goldAiSuggestions.aggregation.metrics.length > 0) {
        setFormData(prev => ({
          ...prev,
          _goldAggregationMetrics: goldAiSuggestions.aggregation.metrics
        }))
      }

      appliedCount++
    }

    // Apply materialization suggestions
    if (goldAiSuggestions.materialization?.enabled !== undefined) {
      goldUpdates.materializationType = goldAiSuggestions.materialization.enabled ? 'materialized_view' : 'view'

      if (goldAiSuggestions.materialization.refresh_strategy) {
        // Map AI refresh strategy to build strategy
        const refreshToBuild: Record<string, 'full_rebuild' | 'incremental'> = {
          'INCREMENTAL': 'incremental',
          'FULL': 'full_rebuild'
        }
        goldUpdates.buildStrategy = refreshToBuild[goldAiSuggestions.materialization.refresh_strategy] || 'full_rebuild'
      }

      appliedCount++
    }

    // Apply indexing suggestions (store for reference)
    if (goldAiSuggestions.indexing?.enabled !== undefined && goldAiSuggestions.indexing.columns && goldAiSuggestions.indexing.columns.length > 0) {
      setFormData(prev => ({
        ...prev,
        _goldIndexingSuggestions: {
          enabled: goldAiSuggestions.indexing.enabled,
          strategy: goldAiSuggestions.indexing.strategy,
          columns: goldAiSuggestions.indexing.columns
        }
      }))
      appliedCount++
    }

    // Update Gold config with all AI suggestions
    updateDestinationConfig({
      goldConfig: {
        ...formData.destinationConfig.goldConfig!,
        ...goldUpdates
      }
    })

    // Show success toast notification
    toast.success(`Applied ${appliedCount} AI suggestions to Gold layer configuration`, 4000)
    console.log('[Gold AI] Applied', appliedCount, 'AI suggestions to Gold layer:', goldUpdates)

    // Collapse the AI suggestions card after applying
    setGoldAiSuggestionsExpanded(false)
  }, [goldAiSuggestions, formData, updateDestinationConfig, setGoldAiSuggestionsExpanded, toast])

  // Fetch AI Data Architect Review
  const fetchAiArchitectReview = React.useCallback(async () => {
    setIsLoadingAiReview(true)
    setAiReviewError(null)
    setAiArchitectReview(null)
    setAiAnalysisProgress(0)
    setAiAnalysisStage('')

    // Progress stages for review UI feedback
    const progressStages = [
      { progress: 10, stage: 'Analyzing source configuration...' },
      { progress: 25, stage: 'Reviewing load strategy settings...' },
      { progress: 40, stage: 'Checking Bronze layer configuration...' },
      { progress: 55, stage: 'Evaluating Silver layer transformations...' },
      { progress: 70, stage: 'Assessing Gold layer modeling...' },
      { progress: 85, stage: 'Identifying risk flags...' },
      { progress: 95, stage: 'Generating recommendations...' }
    ]

    let progressInterval: NodeJS.Timeout | null = null
    let currentStageIndex = 0

    // Start progress animation
    progressInterval = setInterval(() => {
      if (currentStageIndex < progressStages.length) {
        const { progress, stage } = progressStages[currentStageIndex]
        setAiAnalysisProgress(progress)
        setAiAnalysisStage(stage)
        currentStageIndex++
      }
    }, 1000)

    try {
      const response = await fetch('/api/ai/review-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceConfig: formData.sourceConfig,
          destinationConfig: formData.destinationConfig,
          schema: formData._detectedSchema,
          previewData: formData._previewData?.slice(0, 10), // Send limited preview
          sourceName: formData.name,
          sourceType: formData.type
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI review')
      }

      // Complete progress
      if (progressInterval) {
        clearInterval(progressInterval)
        progressInterval = null
      }
      setAiAnalysisProgress(100)
      setAiAnalysisStage('Review complete!')

      const result = await response.json()
      setAiArchitectReview(result.review)
    } catch (error) {
      console.error('[AI Review] Error:', error)
      setAiReviewError(error instanceof Error ? error.message : 'Failed to get AI review')
    } finally {
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      setIsLoadingAiReview(false)
      setAiAnalysisProgress(0)
      setAiAnalysisStage('')
    }
  }, [formData])

  // Apply individual AI recommendation
  const applyAiRecommendation = React.useCallback((layer: 'bronze' | 'silver' | 'gold', index: number) => {
    if (!aiArchitectReview) return

    const recommendations = layer === 'bronze' ? aiArchitectReview.bronzeRecommendations
      : layer === 'silver' ? aiArchitectReview.silverRecommendations
      : aiArchitectReview.goldRecommendations

    const rec = recommendations[index]
    if (!rec || rec.applied) return

    // Apply the recommendation based on layer
    if (layer === 'bronze') {
      updateDestinationConfig({
        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, [rec.field]: rec.suggestedValue }
      })
    } else if (layer === 'silver') {
      updateDestinationConfig({
        silverConfig: { ...formData.destinationConfig.silverConfig!, [rec.field]: rec.suggestedValue }
      })
    } else {
      updateDestinationConfig({
        goldConfig: { ...formData.destinationConfig.goldConfig!, [rec.field]: rec.suggestedValue }
      })
    }

    // Mark as applied
    setAiArchitectReview(prev => {
      if (!prev) return prev
      const newRecommendations = [...(layer === 'bronze' ? prev.bronzeRecommendations : layer === 'silver' ? prev.silverRecommendations : prev.goldRecommendations)]
      newRecommendations[index] = { ...newRecommendations[index], applied: true }
      return {
        ...prev,
        [layer === 'bronze' ? 'bronzeRecommendations' : layer === 'silver' ? 'silverRecommendations' : 'goldRecommendations']: newRecommendations
      }
    })

    toast.success(`Applied ${rec.field} recommendation`, 2000)
  }, [aiArchitectReview, formData, updateDestinationConfig, toast])

  // Apply all AI recommendations
  const applyAllAiRecommendations = React.useCallback(() => {
    if (!aiArchitectReview) return

    let appliedCount = 0

    // Apply bronze recommendations
    aiArchitectReview.bronzeRecommendations.forEach((rec, idx) => {
      if (!rec.applied) {
        updateDestinationConfig({
          bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, [rec.field]: rec.suggestedValue }
        })
        appliedCount++
      }
    })

    // Apply silver recommendations
    aiArchitectReview.silverRecommendations.forEach((rec, idx) => {
      if (!rec.applied) {
        updateDestinationConfig({
          silverConfig: { ...formData.destinationConfig.silverConfig!, [rec.field]: rec.suggestedValue }
        })
        appliedCount++
      }
    })

    // Apply gold recommendations
    aiArchitectReview.goldRecommendations.forEach((rec, idx) => {
      if (!rec.applied) {
        updateDestinationConfig({
          goldConfig: { ...formData.destinationConfig.goldConfig!, [rec.field]: rec.suggestedValue }
        })
        appliedCount++
      }
    })

    // Mark all as applied
    setAiArchitectReview(prev => {
      if (!prev) return prev
      return {
        ...prev,
        bronzeRecommendations: prev.bronzeRecommendations.map(r => ({ ...r, applied: true })),
        silverRecommendations: prev.silverRecommendations.map(r => ({ ...r, applied: true })),
        goldRecommendations: prev.goldRecommendations.map(r => ({ ...r, applied: true }))
      }
    })

    toast.success(`Applied ${appliedCount} AI recommendations`, 3000)
  }, [aiArchitectReview, formData, updateDestinationConfig, toast])

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: // Select Source
        if (!formData.name.trim()) {
          console.log('[isStepValid] Step 1 invalid: name is empty')
          return false
        }

        // For file-based jobs, require file upload OR storage file selection in create mode
        if (formData.type === 'file-based' && mode === 'create') {
          const hasManualUpload = fileSourceMode === 'upload' && formData._uploadedFile
          const hasStorageFile = fileSourceMode === 'storage' && selectedStorageFile
          if (!hasManualUpload && !hasStorageFile) {
            console.log('[isStepValid] Step 1 invalid: no file uploaded or storage file selected')
            return false
          }
        }

        // For database jobs, require connection, table selection, AND schema detection
        if (formData.type === 'database') {
          console.log('[isStepValid] Database validation:', {
            selectedConnectionId,
            tableName: formData.sourceConfig.databaseConfig?.tableName,
            schemaLength: formData._detectedSchema?.length
          })
          if (!selectedConnectionId) {
            console.log('[isStepValid] Step 1 invalid: no connection selected')
            return false
          }
          if (!formData.sourceConfig.databaseConfig?.tableName) {
            console.log('[isStepValid] Step 1 invalid: no table selected')
            return false
          }
          if (!formData._detectedSchema || formData._detectedSchema.length === 0) {
            console.log('[isStepValid] Step 1 invalid: no schema detected')
            return false
          }
        }
        return true
      case 2: // Load Strategy - always valid (has defaults)
        return true
      case 3: // Landing Zone - always valid (has defaults)
        return true
      case 4: // Bronze Layer
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) return false
        return true
      case 5: // Silver Layer
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) return false
        }
        return true
      case 6: // Gold Layer
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) return false
        }
        return true
      case 7: // Review & Create
        return true
      default:
        return true
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Select Source
        if (!formData.name.trim()) newErrors.name = 'Source name is required'

        // For file-based jobs, require file upload OR storage file selection in create mode
        if (formData.type === 'file-based' && mode === 'create') {
          const hasManualUpload = fileSourceMode === 'upload' && formData._uploadedFile
          const hasStorageFile = fileSourceMode === 'storage' && selectedStorageFile
          if (!hasManualUpload && !hasStorageFile) {
            newErrors.file = fileSourceMode === 'upload'
              ? 'File upload is required'
              : 'Please select a file from storage'
          }
        }

        // For database jobs, require connection and table selection
        if (formData.type === 'database') {
          if (!selectedConnectionId) {
            newErrors.connection = 'Please select a database connection'
          }
          if (!formData.sourceConfig.databaseConfig?.tableName) {
            newErrors.table = 'Please select a table from the database'
          }
        }
        break
      case 2: // Load Strategy - no required fields (has defaults)
        break
      case 3: // Landing Zone - no required fields (has defaults)
        break
      case 4: // Bronze Layer
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) {
          newErrors.bronzeTable = 'Bronze table name is required'
        }
        break
      case 5: // Silver Layer
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) {
            newErrors.silverTable = 'Silver table name is required'
          }
        }
        break
      case 6: // Gold Layer
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) {
            newErrors.goldTable = 'Gold table name is required'
          }
        }
        break
      case 7: // Review & Create - validation happens in handleSubmit
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 7))

      // NOTE: AI Data Architect is now manually triggered via button in Step 6 (Review & Create)
      // Auto-trigger removed - user can click "Run AI Data Architect" when ready

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

  function renderStepContent() {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            {/* Basic Information Section */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

              <FormField>
                <FormLabel required>Source Name</FormLabel>
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
                  placeholder="Describe what this source ingests and the data it processes..."
                  rows={2}
                />
              </FormField>

              <details className="border border-border rounded-lg p-3 bg-background-secondary/30">
                <summary className="cursor-pointer text-sm font-semibold text-foreground flex items-center justify-between">
                  Advanced Settings
                  <span className="text-xs text-foreground-muted ml-2">(Execution order)</span>
                </summary>
                <div className="mt-3 space-y-2">
                  <FormLabel>Execution Order</FormLabel>
                  <Input
                    type="number"
                    value={formData.order}
                    onChange={(e) => updateFormData({ order: parseInt(e.target.value) || 1 })}
                    min={1}
                    className="w-32"
                  />
                  <p className="text-xs text-foreground-muted">
                    Default order is assigned automatically. Adjust only if you need this source to run before/after others.
                  </p>
                </div>
              </details>
            </div>

            {/* Source Type Selection */}
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
                      onClick={() => {
                        setFileSourceMode('upload')
                        setSelectedStorageConnectionId(null)
                        setSelectedStorageFile(null)
                        // Clear detected schema when switching modes
                        setFormData(prev => ({
                          ...prev,
                          _detectedSchema: undefined,
                          _previewData: undefined,
                          _detectedMetadata: undefined
                        }))
                      }}
                      className={cn(
                        "p-4 border rounded-lg text-left transition-all",
                        fileSourceMode === 'upload'
                          ? "border-primary bg-primary-50 shadow-md ring-2 ring-primary ring-opacity-50"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Upload className={cn("w-4 h-4", fileSourceMode === 'upload' ? "text-primary" : "text-foreground-muted")} />
                        <span className="font-semibold text-sm">Manual Upload</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        Upload files directly from your computer
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFileSourceMode('storage')
                        // Clear manual upload if switching
                        if (formData._uploadedFile) {
                          setFormData(prev => ({ ...prev, _uploadedFile: undefined, _detectedSchema: undefined, _previewData: undefined }))
                        }
                      }}
                      disabled={storageConnections.length === 0}
                      className={cn(
                        "p-4 border rounded-lg text-left transition-all relative",
                        fileSourceMode === 'storage'
                          ? "border-primary bg-primary-50 shadow-md ring-2 ring-primary ring-opacity-50"
                          : storageConnections.length === 0
                            ? "border-border opacity-60 cursor-not-allowed bg-gray-50"
                            : "border-border hover:border-primary/50"
                      )}
                    >
                      {storageConnections.length === 0 && (
                        <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
                          No Connections
                        </Badge>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <Server className={cn("w-4 h-4", fileSourceMode === 'storage' ? "text-primary" : "text-foreground-muted")} />
                        <span className="font-semibold text-sm">Storage Connection</span>
                      </div>
                      <p className="text-xs text-foreground-muted leading-relaxed">
                        {storageConnections.length > 0
                          ? `${storageConnections.length} connection${storageConnections.length !== 1 ? 's' : ''} available`
                          : 'Configure in Integrations → Sources'}
                      </p>
                    </button>
                  </div>
                  <p className="text-xs text-foreground-muted mt-2">
                    {fileSourceMode === 'upload'
                      ? 'Select where your source files are located. File format will be auto-detected when you upload.'
                      : 'Browse files from your configured storage connections (Local Path, S3/MinIO).'}
                  </p>
                </FormField>

                {/* Storage Connection Selection - Only shown when storage mode is selected */}
                {fileSourceMode === 'storage' && storageConnections.length > 0 && (
                  <div className="space-y-4 p-4 border border-border rounded-lg bg-background-secondary/30">
                    <FormField>
                      <FormLabel required>Select Storage Connection</FormLabel>
                      <Select
                        value={selectedStorageConnectionId || ''}
                        onChange={(e) => {
                          setSelectedStorageConnectionId(e.target.value || null)
                          setSelectedStorageFile(null)
                          setStorageFilesPrefix('')
                        }}
                      >
                        <option value="">Choose a connection...</option>
                        {storageConnections.map((conn) => (
                          <option key={conn.id} value={conn.id}>
                            {conn.name} ({conn.type === 'local' ? 'Local Path' : conn.type === 's3' ? 'S3/MinIO' : conn.type})
                          </option>
                        ))}
                      </Select>
                    </FormField>

                    {/* File Browser */}
                    {selectedStorageConnectionId && (
                      <FormField>
                        <FormLabel required>Select File</FormLabel>
                        <div className="border border-border rounded-lg bg-white">
                          {/* Breadcrumb / Path */}
                          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-gray-50">
                            <Folder className="w-4 h-4 text-foreground-muted" />
                            <button
                              type="button"
                              className="text-sm text-primary hover:underline"
                              onClick={() => setStorageFilesPrefix('')}
                            >
                              Root
                            </button>
                            {storageFilesPrefix && storageFilesPrefix.split('/').filter(Boolean).map((part, idx, arr) => (
                              <React.Fragment key={idx}>
                                <span className="text-foreground-muted">/</span>
                                <button
                                  type="button"
                                  className="text-sm text-primary hover:underline"
                                  onClick={() => setStorageFilesPrefix(arr.slice(0, idx + 1).join('/') + '/')}
                                >
                                  {part}
                                </button>
                              </React.Fragment>
                            ))}
                            <div className="flex-1" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => fetchStorageFiles(selectedStorageConnectionId, storageFilesPrefix)}
                              disabled={isLoadingStorageFiles}
                            >
                              <RefreshCw className={cn("w-4 h-4", isLoadingStorageFiles && "animate-spin")} />
                            </Button>
                          </div>

                          {/* File List */}
                          <div className="max-h-64 overflow-y-auto">
                            {isLoadingStorageFiles ? (
                              <div className="flex items-center justify-center py-8">
                                <RefreshCw className="w-5 h-5 text-foreground-muted animate-spin mr-2" />
                                <span className="text-sm text-foreground-muted">Loading files...</span>
                              </div>
                            ) : storageFiles.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-foreground-muted">
                                <FolderOpen className="w-8 h-8 mb-2" />
                                <span className="text-sm">No supported files found</span>
                                <span className="text-xs mt-1">Supported: CSV, JSON, Parquet, Excel</span>
                              </div>
                            ) : (
                              <div className="divide-y divide-border">
                                {storageFiles.map((file, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    className={cn(
                                      "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 transition-colors",
                                      selectedStorageFile?.path === file.path && "bg-primary-50 border-l-2 border-primary"
                                    )}
                                    onClick={() => {
                                      if (file.isDirectory) {
                                        setStorageFilesPrefix(file.path + '/')
                                      } else {
                                        setSelectedStorageFile(file)
                                        // Fetch file preview (schema + sample data) for AI analysis
                                        if (selectedStorageConnectionId) {
                                          fetchStorageFilePreview(selectedStorageConnectionId, file.path, file)
                                        }
                                      }
                                    }}
                                  >
                                    {file.isDirectory ? (
                                      <Folder className="w-4 h-4 text-amber-500" />
                                    ) : (
                                      <FileText className="w-4 h-4 text-blue-500" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium truncate">{file.name}</div>
                                      {!file.isDirectory && file.size !== undefined && (
                                        <div className="text-xs text-foreground-muted">
                                          {file.size < 1024
                                            ? `${file.size} B`
                                            : file.size < 1024 * 1024
                                              ? `${(file.size / 1024).toFixed(1)} KB`
                                              : `${(file.size / (1024 * 1024)).toFixed(1)} MB`}
                                          {file.lastModified && ` • ${new Date(file.lastModified).toLocaleDateString()}`}
                                        </div>
                                      )}
                                    </div>
                                    {selectedStorageFile?.path === file.path && (
                                      <CheckCircle className="w-4 h-4 text-primary" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Selected file info */}
                        {selectedStorageFile && (
                          <div className={cn(
                            "mt-2 p-3 rounded-md border",
                            isLoadingStoragePreview
                              ? "bg-blue-50 border-blue-200"
                              : formData._detectedSchema
                                ? "bg-green-50 border-green-200"
                                : "bg-yellow-50 border-yellow-200"
                          )}>
                            <div className="flex items-center gap-2">
                              {isLoadingStoragePreview ? (
                                <>
                                  <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                                  <span className="text-sm font-medium text-blue-800">Loading file schema...</span>
                                </>
                              ) : formData._detectedSchema ? (
                                <>
                                  <CheckCircle className="w-4 h-4 text-green-600" />
                                  <span className="text-sm font-medium text-green-800">Selected: {selectedStorageFile.name}</span>
                                </>
                              ) : (
                                <>
                                  <FileText className="w-4 h-4 text-yellow-600" />
                                  <span className="text-sm font-medium text-yellow-800">Selected: {selectedStorageFile.name}</span>
                                </>
                              )}
                            </div>
                            <p className={cn(
                              "text-xs mt-1",
                              isLoadingStoragePreview ? "text-blue-700" : formData._detectedSchema ? "text-green-700" : "text-yellow-700"
                            )}>
                              Path: {selectedStorageFile.path}
                              {formData._detectedSchema && !isLoadingStoragePreview && (
                                <span className="ml-2">• {formData._detectedSchema.length} columns detected</span>
                              )}
                            </p>
                          </div>
                        )}

                        {/* Schema Analysis for Storage File - similar to CSV upload */}
                        {fileSourceMode === 'storage' && formData._detectedSchema && formData._detectedSchema.length > 0 && !isLoadingStoragePreview && (
                          <div className="mt-4 space-y-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-blue-700">{formData._detectedSchema.length}</div>
                                <div className="text-xs text-blue-600 font-medium">Columns</div>
                              </div>
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-green-700">{formData._previewData?.length || 0}</div>
                                <div className="text-xs text-green-600 font-medium">Sample Rows</div>
                              </div>
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-purple-700">
                                  {formData._detectedSchema.filter((col: any) => col.type !== 'object' && col.type !== 'string').length}
                                </div>
                                <div className="text-xs text-purple-600 font-medium">Typed Columns</div>
                              </div>
                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
                                <div className="text-xl font-bold text-amber-700">
                                  {formData._detectedSchema.filter((col: any) => col.nullable).length}
                                </div>
                                <div className="text-xs text-amber-600 font-medium">Nullable Columns</div>
                              </div>
                            </div>

                            {/* Column Schema Table */}
                            <Card>
                              <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center justify-between">
                                  <span>Column Schema Analysis</span>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowStoragePreview(!showStoragePreview)}
                                  >
                                    <Eye className="w-4 h-4 mr-2" />
                                    {showStoragePreview ? 'Hide' : 'Show'} Data Preview
                                  </Button>
                                </CardTitle>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                  <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-white">
                                      <tr className="border-b border-border">
                                        <th className="text-left p-2 font-semibold text-foreground-muted w-16">
                                          <div className="flex items-center gap-2">
                                            <input
                                              type="checkbox"
                                              checked={!((formData.destinationConfig.bronzeConfig as any)?.excludedColumns?.length > 0)}
                                              onChange={(e) => {
                                                const allColumns = formData._detectedSchema?.map((c: any) => c.name) || []
                                                updateDestinationConfig({
                                                  bronzeConfig: {
                                                    ...formData.destinationConfig.bronzeConfig!,
                                                    excludedColumns: e.target.checked ? [] : allColumns
                                                  } as any
                                                })
                                              }}
                                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                            />
                                            <span>Include</span>
                                          </div>
                                        </th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">#</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Column Name</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Data Type</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Sample Value</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Nullable</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {formData._detectedSchema.map((col: any, index: number) => {
                                        const isExcluded = (formData.destinationConfig.bronzeConfig as any)?.excludedColumns?.includes(col.name)
                                        return (
                                        <tr key={index} className={cn("border-b border-border hover:bg-background-secondary transition-colors", isExcluded && "opacity-50 bg-gray-50")}>
                                          <td className="p-2">
                                            <input
                                              type="checkbox"
                                              checked={!isExcluded}
                                              onChange={(e) => {
                                                const currentExcluded = (formData.destinationConfig.bronzeConfig as any)?.excludedColumns || []
                                                const newExcluded = e.target.checked
                                                  ? currentExcluded.filter((c: string) => c !== col.name)
                                                  : [...currentExcluded, col.name]
                                                updateDestinationConfig({
                                                  bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, excludedColumns: newExcluded } as any
                                                })
                                              }}
                                              className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                                            />
                                          </td>
                                          <td className="p-2 text-foreground-muted font-mono text-xs">{index + 1}</td>
                                          <td className="p-2">
                                            <div className="font-medium text-foreground font-mono text-xs">{col.name}</div>
                                          </td>
                                          <td className="p-2">
                                            <Badge
                                              variant="secondary"
                                              className={cn(
                                                "text-xs",
                                                col.type === 'int64' || col.type === 'integer' ? 'bg-blue-100 text-blue-800' :
                                                col.type === 'float64' || col.type === 'decimal' ? 'bg-green-100 text-green-800' :
                                                col.type === 'datetime64[ns]' || col.type === 'date' ? 'bg-purple-100 text-purple-800' :
                                                col.type === 'bool' ? 'bg-orange-100 text-orange-800' :
                                                'bg-gray-100 text-gray-800'
                                              )}
                                            >
                                              {col.type}
                                            </Badge>
                                          </td>
                                          <td className="p-2 max-w-xs">
                                            <div className="truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded border">
                                              {col.sample || '—'}
                                            </div>
                                          </td>
                                          <td className="p-2">
                                            {col.nullable ? (
                                              <span className="text-amber-600 text-xs">Yes</span>
                                            ) : (
                                              <span className="text-green-600 text-xs">No</span>
                                            )}
                                          </td>
                                        </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </CardContent>
                            </Card>

                            {/* Data Preview */}
                            {showStoragePreview && formData._previewData && formData._previewData.length > 0 && (
                              <Card>
                                <CardHeader className="pb-3">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-base flex items-center gap-2">
                                      <FileText className="w-5 h-5 text-primary" />
                                      Data Preview - First {formData._previewData.length} Rows
                                    </CardTitle>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-0">
                                  <div className="border border-border rounded-lg overflow-hidden">
                                    <div className="overflow-x-auto max-h-72 overflow-y-auto">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-50 border-b border-border sticky top-0">
                                          <tr>
                                            <th className="text-left p-2 font-semibold text-foreground-muted border-r border-border bg-gray-100 sticky left-0 z-10">
                                              #
                                            </th>
                                            {formData._detectedSchema?.map((col: any, index: number) => (
                                              <th key={index} className="text-left p-2 font-semibold text-foreground-muted min-w-28 border-r border-border last:border-r-0">
                                                <div className="flex flex-col gap-1">
                                                  <span className="font-mono text-xs truncate max-w-24" title={col.name}>{col.name}</span>
                                                  <Badge
                                                    variant="outline"
                                                    className={cn(
                                                      "text-xs w-fit",
                                                      col.type === 'int64' || col.type === 'integer' ? 'border-blue-300 text-blue-700' :
                                                      col.type === 'float64' || col.type === 'decimal' ? 'border-green-300 text-green-700' :
                                                      col.type === 'datetime64[ns]' || col.type === 'date' ? 'border-purple-300 text-purple-700' :
                                                      'border-gray-300 text-gray-700'
                                                    )}
                                                  >
                                                    {col.type}
                                                  </Badge>
                                                </div>
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {formData._previewData.slice(0, 20).map((row: any, rowIndex: number) => (
                                            <tr key={rowIndex} className="border-b border-border hover:bg-blue-50 transition-colors">
                                              <td className="p-2 font-mono text-xs text-foreground-muted font-semibold border-r border-border bg-gray-50 sticky left-0 z-10">
                                                {rowIndex + 1}
                                              </td>
                                              {formData._detectedSchema?.map((col: any, colIndex: number) => {
                                                const value = row[col.name]
                                                const isEmpty = value === null || value === undefined || value === ''
                                                return (
                                                  <td key={colIndex} className="p-2 border-r border-border last:border-r-0">
                                                    <div className={cn(
                                                      "font-mono text-xs truncate max-w-32",
                                                      isEmpty ? 'text-gray-400 italic' : 'text-foreground'
                                                    )} title={isEmpty ? 'null' : String(value)}>
                                                      {isEmpty ? 'null' : String(value)}
                                                    </div>
                                                  </td>
                                                )
                                              })}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}
                          </div>
                        )}
                      </FormField>
                    )}
                  </div>
                )}

                {/* Manual Upload Mode - Only shown when upload mode is selected */}
                {fileSourceMode === 'upload' && (
                  <>
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

                  {/* Show existing file info in edit mode */}
                  {mode === 'edit' && editingJob && !formData._uploadedFile && (
                    <div className="border-2 border-dashed border-border rounded-lg p-6 bg-background-secondary/30">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-foreground mb-1">Current Source File</h4>
                          <p className="text-sm text-foreground font-mono truncate mb-2">
                            {editingJob.sourceConfig.fileConfig?.filePath || 'File reference stored'}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-foreground-muted">
                            {editingJob.sourceConfig.fileConfig?.hasHeader !== undefined && (
                              <span className="px-2 py-1 bg-background-secondary rounded">
                                Headers: {editingJob.sourceConfig.fileConfig.hasHeader ? 'Yes' : 'No'}
                              </span>
                            )}
                            {editingJob.sourceConfig.fileConfig?.delimiter && (
                              <span className="px-2 py-1 bg-background-secondary rounded">
                                Delimiter: {editingJob.sourceConfig.fileConfig.delimiter}
                              </span>
                            )}
                            {editingJob.sourceConfig.fileConfig?.encoding && (
                              <span className="px-2 py-1 bg-background-secondary rounded">
                                Encoding: {editingJob.sourceConfig.fileConfig.encoding}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="text-xs text-amber-800">
                            <p className="font-semibold mb-1">About File Replacement</p>
                            <p>The source file is stored in the landing zone and referenced by this job. You can upload a replacement file below if needed, but the existing data will continue to be used unless replaced.</p>
                          </div>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full"
                        onClick={() => {
                          // Trigger file input click
                          csvUploadRef.current?.reset()
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Replacement File (Optional)
                      </Button>
                    </div>
                  )}

                  {/* Show CSV upload component if creating or if replacing file */}
                  {(mode === 'create' || !editingJob || formData._uploadedFile) && (
                    <CSVFileUpload
                      ref={csvUploadRef}
                      onFileUpload={(file, schema, preview, columnMappings, metadata) => {
                      console.log('[CSV Upload] Received metadata:', metadata)

                      // Auto-generate table names from filename
                      const cleanName = file.name
                        .replace(/\.[^/.]+$/, '') // Remove extension
                        .toLowerCase()
                        .replace(/[^a-z0-9]/g, '_') // Replace special chars with underscore

                      // Store column mappings in transformationConfig if provided (headerless CSV)
                      const transformationConfig = columnMappings && columnMappings.length > 0
                        ? {
                            columnMappings: columnMappings,
                            useDirectSql: false
                          }
                        : undefined

                      // Store metadata for Step 2 Load Strategy configuration
                      console.log('[CSV Upload] Temporal columns detected:', metadata?.temporal_columns)
                      console.log('[CSV Upload] PK candidates detected:', metadata?.pk_candidates)

                      setFormData(prev => ({
                        ...prev,
                        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
                        _uploadedFile: file,
                        _detectedSchema: schema,
                        _previewData: preview,
                        _detectedMetadata: metadata, // Store initial metadata, AI will enhance it
                        transformationConfig: transformationConfig,
                        // Update source config with hasHeader flag (incremental settings configured in Step 2)
                        sourceConfig: {
                          ...prev.sourceConfig,
                          fileConfig: {
                            ...prev.sourceConfig.fileConfig!,
                            filePath: file.name,
                            filePattern: file.name,
                            hasHeader: !columnMappings || columnMappings.length === 0
                          }
                        },
                        // Auto-populate destination table names
                        destinationConfig: {
                          ...prev.destinationConfig,
                          bronzeConfig: {
                            ...prev.destinationConfig.bronzeConfig!,
                            tableName: `${cleanName}_bronze`
                          },
                          silverConfig: {
                            ...prev.destinationConfig.silverConfig!,
                            tableName: `${cleanName}_silver`
                          },
                          goldConfig: {
                            ...prev.destinationConfig.goldConfig!,
                            tableName: `${cleanName}_gold`
                          }
                        }
                      } as any))

                      // Trigger AI Schema Intelligence analysis
                      fetchSchemaIntelligence(schema, preview, file.name, preview?.length)
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
                      excludedColumns={(formData.destinationConfig.bronzeConfig as any)?.excludedColumns || []}
                      onExcludedColumnsChange={(excludedColumns) => {
                        updateDestinationConfig({
                          bronzeConfig: {
                            ...formData.destinationConfig.bronzeConfig!,
                            excludedColumns
                          } as any
                        })
                      }}
                    />
                  )}
                    {errors.file && <FormError>{errors.file}</FormError>}
                  </FormField>
                  </>
                )}

                {/* Schema Intelligence Display (AI-Powered) */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-purple-900">Schema Intelligence</span>
                          {isLoadingSchemaIntelligence && (
                            <span className="text-xs text-purple-600 animate-pulse">Analyzing...</span>
                          )}
                          {formData._detectedMetadata?.ai_analyzed && (
                            <Badge variant="default" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                              AI Powered
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Loading State with Progress Bar */}
                      {isLoadingSchemaIntelligence && (
                        <div className="py-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-purple-700 font-medium">{schemaIntelligenceStage || 'Starting analysis...'}</span>
                            <span className="text-purple-600 font-mono">{schemaIntelligenceProgress}%</span>
                          </div>
                          <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${schemaIntelligenceProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-500">
                            Detecting primary keys, relationships, and data patterns
                          </p>
                        </div>
                      )}

                      {/* Error State */}
                      {schemaIntelligenceError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <p className="text-xs text-red-700">{schemaIntelligenceError}</p>
                        </div>
                      )}

                      {/* Results */}
                      {!isLoadingSchemaIntelligence && (
                        <>
                          {/* Summary */}
                          {formData._detectedMetadata?.summary && (
                            <div className="bg-white rounded-lg p-3 border border-purple-200 mb-4">
                              <p className="text-sm text-purple-900">{formData._detectedMetadata.summary}</p>
                              {formData._detectedMetadata.table_type && (
                                <Badge variant="default" className="mt-2 text-xs bg-purple-100 text-purple-700 border-purple-300">
                                  {formData._detectedMetadata.table_type.charAt(0).toUpperCase() + formData._detectedMetadata.table_type.slice(1)} Table
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <div className="text-xl font-bold text-blue-700">{formData._detectedSchema.length}</div>
                              <div className="text-xs text-blue-600 font-medium">Columns</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <div className="text-xl font-bold text-green-700">
                                {formData._detectedMetadata?.pk_candidates?.length || 0}
                              </div>
                              <div className="text-xs text-green-600 font-medium">Primary Keys</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-orange-200">
                              <div className="text-xl font-bold text-orange-700">
                                {formData._detectedMetadata?.foreign_keys?.length || 0}
                              </div>
                              <div className="text-xs text-orange-600 font-medium">Foreign Keys</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                              <div className="text-xl font-bold text-purple-700">
                                {formData._detectedMetadata?.temporal_columns?.length || 0}
                              </div>
                              <div className="text-xs text-purple-600 font-medium">Temporal</div>
                            </div>
                          </div>

                          {/* Data Quality Summary */}
                          {formData._detectedSchema.some((col: any) => col.nullPercentage !== undefined) && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-semibold text-gray-900">Data Quality Summary</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-green-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) < 5).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Good (&lt;5% null)</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-amber-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-amber-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) >= 5 && (col.nullPercentage || 0) < 20).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Moderate (5-20%)</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-red-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) >= 20).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Concerns (&gt;20%)</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Detected Intelligence */}
                          <div className="space-y-3">
                            {/* Primary Keys */}
                            {formData._detectedMetadata?.pk_candidates && formData._detectedMetadata.pk_candidates.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Key className="w-4 h-4 text-green-600" />
                                  <span className="text-xs font-semibold text-green-900">
                                    Primary Key{formData._detectedMetadata.pk_candidates.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {formData._detectedMetadata.pk_candidates.map((col: string, idx: number) => (
                                    <Badge key={idx} variant="success" className="text-xs font-mono">
                                      {col}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Foreign Keys */}
                            {formData._detectedMetadata?.foreign_keys && formData._detectedMetadata.foreign_keys.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-orange-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Link2 className="w-4 h-4 text-orange-600" />
                                  <span className="text-xs font-semibold text-orange-900">
                                    Foreign Keys ({formData._detectedMetadata.foreign_keys.length})
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {formData._detectedMetadata.foreign_keys.map((fk: { column: string; referencesTable: string }, idx: number) => (
                                    <div key={idx} className="text-xs text-orange-700 flex items-center gap-1">
                                      <Badge variant="default" className="font-mono bg-orange-100 text-orange-800 border-orange-300">
                                        {fk.column}
                                      </Badge>
                                      <span className="text-orange-500">→</span>
                                      <span className="font-medium">{fk.referencesTable}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Temporal Columns */}
                            {formData._detectedMetadata?.temporal_columns && formData._detectedMetadata.temporal_columns.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-purple-600" />
                                  <span className="text-xs font-semibold text-purple-900">
                                    Temporal Columns
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {formData._detectedMetadata.temporal_columns.map((col: string, idx: number) => (
                                    <Badge key={idx} variant="default" className="text-xs font-mono bg-purple-100 text-purple-800 border-purple-300">
                                      {col}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-xs text-purple-600 mt-2">
                                  Suitable for incremental loading and partitioning
                                </p>
                              </div>
                            )}

                            {/* Measure & Dimension Columns */}
                            {((formData._detectedMetadata?.measure_columns?.length || 0) > 0 ||
                              (formData._detectedMetadata?.dimension_columns?.length || 0) > 0) && (
                              <div className="grid grid-cols-2 gap-3">
                                {formData._detectedMetadata?.measure_columns && formData._detectedMetadata.measure_columns.length > 0 && (
                                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <BarChart3 className="w-4 h-4 text-blue-600" />
                                      <span className="text-xs font-semibold text-blue-900">Measures</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {formData._detectedMetadata.measure_columns.slice(0, 5).map((col: string, idx: number) => (
                                        <Badge key={idx} variant="default" className="text-xs font-mono bg-blue-100 text-blue-800 border-blue-300">
                                          {col}
                                        </Badge>
                                      ))}
                                      {formData._detectedMetadata.measure_columns.length > 5 && (
                                        <span className="text-xs text-blue-600">+{formData._detectedMetadata.measure_columns.length - 5} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {formData._detectedMetadata?.dimension_columns && formData._detectedMetadata.dimension_columns.length > 0 && (
                                  <div className="bg-white rounded-lg p-3 border border-teal-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Layers className="w-4 h-4 text-teal-600" />
                                      <span className="text-xs font-semibold text-teal-900">Dimensions</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {formData._detectedMetadata.dimension_columns.slice(0, 5).map((col: string, idx: number) => (
                                        <Badge key={idx} variant="default" className="text-xs font-mono bg-teal-100 text-teal-800 border-teal-300">
                                          {col}
                                        </Badge>
                                      ))}
                                      {formData._detectedMetadata.dimension_columns.length > 5 && (
                                        <span className="text-xs text-teal-600">+{formData._detectedMetadata.dimension_columns.length - 5} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Data Quality Hints */}
                            {formData._detectedMetadata?.data_quality_hints && formData._detectedMetadata.data_quality_hints.length > 0 && (
                              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600" />
                                  <span className="text-xs font-semibold text-amber-900">AI Recommendations</span>
                                </div>
                                <ul className="space-y-1">
                                  {formData._detectedMetadata.data_quality_hints.map((hint: string, idx: number) => (
                                    <li key={idx} className="text-xs text-amber-700 flex items-start gap-2">
                                      <span className="text-amber-500 mt-0.5">•</span>
                                      {hint}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Database Source Configuration - Only shown for database jobs */}
            {formData.type === 'database' && (
              <div className="space-y-6">
                {/* Section Header */}
                <div>
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                    Database Connection
                  </h3>
                  <p className="text-xs text-foreground-muted mt-2">
                    Select an existing database connection to access your data
                  </p>
                </div>

                {/* Connection Selection */}
                <FormField>
                  <FormLabel required>Select Connection</FormLabel>
                  <div className="flex gap-2">
                    <Select
                      value={selectedConnectionId || ''}
                      onChange={(e) => handleConnectionSelect(e.target.value)}
                      className="flex-1"
                    >
                      <option value="">-- Select a database connection --</option>
                      {availableConnections.map((conn) => (
                        <option key={conn.id} value={conn.id}>
                          {conn.name} ({conn.type === 'sql-server' ? 'SQL Server' : conn.type === 'postgresql' ? 'PostgreSQL' : conn.type === 'mysql' ? 'MySQL' : 'Oracle'})
                        </option>
                      ))}
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreatingConnection(true)}
                      className="whitespace-nowrap"
                    >
                      + New Connection
                    </Button>
                  </div>
                  {errors.connection && <FormError>{errors.connection}</FormError>}
                </FormField>

                {/* Connection Details Card - Shown when connection is selected */}
                {selectedConnectionId && (() => {
                  const selectedConn = availableConnections.find(c => c.id === selectedConnectionId)
                  return selectedConn && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Database className="w-4 h-4 text-blue-600" />
                              <span className="text-sm font-semibold text-blue-900">{selectedConn.name}</span>
                              <Badge variant="success" className="text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Connected
                              </Badge>
                            </div>
                            <div className="text-xs text-blue-700 space-y-1 ml-6">
                              <div><span className="font-medium">Type:</span> {selectedConn.type === 'postgresql' ? 'PostgreSQL' : selectedConn.type === 'sql-server' ? 'SQL Server' : selectedConn.type}</div>
                              <div><span className="font-medium">Host:</span> {selectedConn.host}:{selectedConn.port}</div>
                              <div><span className="font-medium">Database:</span> {selectedConn.database}</div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })()}

                {/* Table Selection Section - Only shown when connection is selected */}
                {selectedConnectionId && formData.sourceConfig.type && formData.sourceConfig.type !== 'csv' && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground border-b pb-2">
                        Table Selection
                      </h3>
                      <p className="text-xs text-foreground-muted mt-2">
                        Choose a table from your database to ingest
                      </p>
                    </div>

                    <DatabaseSourceConfig
                      dbType={formData.sourceConfig.type}
                      connection={formData.sourceConfig.connection || {}}
                      databaseConfig={formData.sourceConfig.databaseConfig || {
                        tableName: '',
                        isIncremental: false,
                        deltaColumn: '',
                        lastWatermark: ''
                      }}
                      useSavedConnection={true}
                      connectionId={selectedConnectionId}
                      excludedColumns={(formData.destinationConfig.bronzeConfig as any)?.excludedColumns || []}
                      onExcludedColumnsChange={(excludedColumns) => {
                        updateDestinationConfig({
                          bronzeConfig: {
                            ...formData.destinationConfig.bronzeConfig!,
                            excludedColumns
                          } as any
                        })
                      }}
                      onConnectionChange={(connection) => {
                        updateSourceConfig({ connection })
                      }}
                      onDatabaseConfigChange={(databaseConfig) => {
                        updateSourceConfig({ databaseConfig })
                      }}
                      onSchemaDetected={(schema, tableName, metadata) => {
                        console.log('[Step1] onSchemaDetected called with schema:', schema?.length, 'columns, tableName:', tableName)
                        console.log('[Step1] Metadata:', metadata)

                        // Store detected schema and preview, auto-populate name from table name
                        setFormData(prev => ({
                          ...prev,
                          name: prev.name || tableName || '', // Auto-populate source name from table name (like file uploads)
                          _detectedSchema: schema,
                          _previewData: metadata?.preview
                        }))

                        // Auto-generate table name from source table
                        console.log('[Step1] Using tableName from callback:', tableName)

                        if (tableName) {
                          const cleanName = tableName.toLowerCase().replace(/[^a-z0-9]/g, '_')

                          // Auto-configure incremental loading if temporal column detected
                          const hasTemporalColumn = metadata?.temporal_columns && metadata.temporal_columns.length > 0
                          console.log('[Step1] Temporal columns detected:', metadata?.temporal_columns)
                          console.log('[Step1] Auto-configuring incremental:', hasTemporalColumn)

                          updateDestinationConfig({
                            bronzeConfig: {
                              ...formData.destinationConfig.bronzeConfig!,
                              tableName: `${cleanName}_bronze`
                            },
                            silverConfig: {
                              ...formData.destinationConfig.silverConfig!,
                              tableName: `${cleanName}_silver`
                            },
                            goldConfig: {
                              ...formData.destinationConfig.goldConfig!,
                              tableName: `${cleanName}_gold`
                            }
                          })

                          // Store metadata for Step 2 Load Strategy configuration
                          // Don't auto-configure incremental settings - let user choose in Load Strategy step
                          setFormData(prev => ({
                            ...prev,
                            _detectedMetadata: {
                              temporal_columns: metadata?.temporal_columns || [],
                              pk_candidates: [] // Let AI Schema Intelligence populate this
                            }
                          }))

                          // Trigger AI Schema Intelligence for database sources (same as file uploads)
                          if (schema && schema.length > 0) {
                            fetchSchemaIntelligence(schema, metadata?.preview, tableName, metadata?.rowCount)
                          }

                          // Update source config with table name only (incremental settings configured in Step 2)
                          updateSourceConfig({
                            databaseConfig: {
                              ...formData.sourceConfig.databaseConfig,
                              tableName,
                              isIncremental: false // Default to full load, configured in Step 2
                            }
                          })

                          // Fetch AI suggestions for Bronze layer
                          console.log('[Step1] Scheduling AI suggestions fetch in 500ms...')
                          console.log('[Step1] Will fetch with:', {
                            tableName,
                            connectionId: selectedConnectionId,
                            dbType: formData.sourceConfig.type
                          })
                          setTimeout(() => {
                            console.log('[Step1] Calling fetchAiSuggestions now with direct parameters...')
                            fetchAiSuggestions(tableName, selectedConnectionId, formData.sourceConfig.type)
                          }, 500)
                        } else {
                          console.log('[Step1] No table name provided - skipping AI suggestions')
                        }
                      }}
                    />
                  </>
                )}

                {/* Schema Intelligence Display (AI-Powered) - Database Source */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-600" />
                          <span className="text-purple-900">Schema Intelligence</span>
                          {isLoadingSchemaIntelligence && (
                            <span className="text-xs text-purple-600 animate-pulse">Analyzing...</span>
                          )}
                          {formData._detectedMetadata?.ai_analyzed && (
                            <Badge variant="default" className="text-xs bg-purple-100 text-purple-700 border-purple-300">
                              AI Powered
                            </Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Loading State with Progress Bar */}
                      {isLoadingSchemaIntelligence && (
                        <div className="py-4 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-purple-700 font-medium">{schemaIntelligenceStage || 'Starting analysis...'}</span>
                            <span className="text-purple-600 font-mono">{schemaIntelligenceProgress}%</span>
                          </div>
                          <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${schemaIntelligenceProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-purple-500">
                            Detecting primary keys, relationships, and data patterns
                          </p>
                        </div>
                      )}

                      {/* Error State */}
                      {schemaIntelligenceError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                          <p className="text-xs text-red-700">{schemaIntelligenceError}</p>
                        </div>
                      )}

                      {/* Results */}
                      {!isLoadingSchemaIntelligence && (
                        <>
                          {/* Summary */}
                          {formData._detectedMetadata?.summary && (
                            <div className="bg-white rounded-lg p-3 border border-purple-200 mb-4">
                              <p className="text-sm text-purple-900">{formData._detectedMetadata.summary}</p>
                              {formData._detectedMetadata.table_type && (
                                <Badge variant="default" className="mt-2 text-xs bg-purple-100 text-purple-700 border-purple-300">
                                  {formData._detectedMetadata.table_type.charAt(0).toUpperCase() + formData._detectedMetadata.table_type.slice(1)} Table
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <div className="text-xl font-bold text-blue-700">{formData._detectedSchema.length}</div>
                              <div className="text-xs text-blue-600 font-medium">Columns</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <div className="text-xl font-bold text-green-700">
                                {formData._detectedMetadata?.pk_candidates?.length || 0}
                              </div>
                              <div className="text-xs text-green-600 font-medium">Primary Keys</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-orange-200">
                              <div className="text-xl font-bold text-orange-700">
                                {formData._detectedMetadata?.foreign_keys?.length || 0}
                              </div>
                              <div className="text-xs text-orange-600 font-medium">Foreign Keys</div>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                              <div className="text-xl font-bold text-purple-700">
                                {formData._detectedMetadata?.temporal_columns?.length || 0}
                              </div>
                              <div className="text-xs text-purple-600 font-medium">Temporal</div>
                            </div>
                          </div>

                          {/* Data Quality Summary */}
                          {formData._detectedSchema.some((col: any) => col.nullPercentage !== undefined) && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200 mb-4">
                              <div className="flex items-center gap-2 mb-3">
                                <CheckCircle2 className="w-4 h-4 text-gray-600" />
                                <span className="text-xs font-semibold text-gray-900">Data Quality Summary</span>
                              </div>
                              <div className="grid grid-cols-3 gap-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-green-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-green-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) < 5).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Good (&lt;5% null)</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-amber-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-amber-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) >= 5 && (col.nullPercentage || 0) < 20).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Moderate (5-20%)</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 bg-red-500 rounded-full flex-shrink-0"></div>
                                  <div>
                                    <span className="font-mono text-sm text-red-700 font-bold">
                                      {formData._detectedSchema.filter((col: any) => (col.nullPercentage || 0) >= 20).length}
                                    </span>
                                    <span className="text-xs text-gray-600 ml-1">Concerns (&gt;20%)</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Detected Intelligence */}
                          <div className="space-y-3">
                            {/* Primary Keys */}
                            {formData._detectedMetadata?.pk_candidates && formData._detectedMetadata.pk_candidates.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Key className="w-4 h-4 text-green-600" />
                                  <span className="text-xs font-semibold text-green-900">
                                    Primary Key{formData._detectedMetadata.pk_candidates.length > 1 ? 's' : ''}
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {formData._detectedMetadata.pk_candidates.map((col: string, idx: number) => (
                                    <Badge key={idx} variant="success" className="text-xs font-mono">
                                      {col}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Foreign Keys */}
                            {formData._detectedMetadata?.foreign_keys && formData._detectedMetadata.foreign_keys.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-orange-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Link2 className="w-4 h-4 text-orange-600" />
                                  <span className="text-xs font-semibold text-orange-900">
                                    Foreign Keys ({formData._detectedMetadata.foreign_keys.length})
                                  </span>
                                </div>
                                <div className="space-y-1">
                                  {formData._detectedMetadata.foreign_keys.map((fk: { column: string; referencesTable: string }, idx: number) => (
                                    <div key={idx} className="text-xs text-orange-700 flex items-center gap-1">
                                      <Badge variant="default" className="font-mono bg-orange-100 text-orange-800 border-orange-300">
                                        {fk.column}
                                      </Badge>
                                      <span className="text-orange-500">→</span>
                                      <span className="font-medium">{fk.referencesTable}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Temporal Columns */}
                            {formData._detectedMetadata?.temporal_columns && formData._detectedMetadata.temporal_columns.length > 0 && (
                              <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-purple-600" />
                                  <span className="text-xs font-semibold text-purple-900">
                                    Temporal Columns
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {formData._detectedMetadata.temporal_columns.map((col: string, idx: number) => (
                                    <Badge key={idx} variant="default" className="text-xs font-mono bg-purple-100 text-purple-800 border-purple-300">
                                      {col}
                                    </Badge>
                                  ))}
                                </div>
                                <p className="text-xs text-purple-600 mt-2">
                                  Suitable for incremental loading and partitioning
                                </p>
                              </div>
                            )}

                            {/* Measure & Dimension Columns */}
                            {((formData._detectedMetadata?.measure_columns?.length || 0) > 0 ||
                              (formData._detectedMetadata?.dimension_columns?.length || 0) > 0) && (
                              <div className="grid grid-cols-2 gap-3">
                                {formData._detectedMetadata?.measure_columns && formData._detectedMetadata.measure_columns.length > 0 && (
                                  <div className="bg-white rounded-lg p-3 border border-blue-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <BarChart3 className="w-4 h-4 text-blue-600" />
                                      <span className="text-xs font-semibold text-blue-900">Measures</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {formData._detectedMetadata.measure_columns.slice(0, 5).map((col: string, idx: number) => (
                                        <Badge key={idx} variant="default" className="text-xs font-mono bg-blue-100 text-blue-800 border-blue-300">
                                          {col}
                                        </Badge>
                                      ))}
                                      {formData._detectedMetadata.measure_columns.length > 5 && (
                                        <span className="text-xs text-blue-600">+{formData._detectedMetadata.measure_columns.length - 5} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {formData._detectedMetadata?.dimension_columns && formData._detectedMetadata.dimension_columns.length > 0 && (
                                  <div className="bg-white rounded-lg p-3 border border-teal-200">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Layers className="w-4 h-4 text-teal-600" />
                                      <span className="text-xs font-semibold text-teal-900">Dimensions</span>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {formData._detectedMetadata.dimension_columns.slice(0, 5).map((col: string, idx: number) => (
                                        <Badge key={idx} variant="default" className="text-xs font-mono bg-teal-100 text-teal-800 border-teal-300">
                                          {col}
                                        </Badge>
                                      ))}
                                      {formData._detectedMetadata.dimension_columns.length > 5 && (
                                        <span className="text-xs text-teal-600">+{formData._detectedMetadata.dimension_columns.length - 5} more</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Data Quality Hints */}
                            {formData._detectedMetadata?.data_quality_hints && formData._detectedMetadata.data_quality_hints.length > 0 && (
                              <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <AlertCircle className="w-4 h-4 text-amber-600" />
                                  <span className="text-xs font-semibold text-amber-900">AI Recommendations</span>
                                </div>
                                <ul className="space-y-1">
                                  {formData._detectedMetadata.data_quality_hints.map((hint: string, idx: number) => (
                                    <li key={idx} className="text-xs text-amber-700 flex items-start gap-2">
                                      <span className="text-amber-500 mt-0.5">•</span>
                                      {hint}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )

      case 2: // Load Strategy Step (NEW)
        return (
          <div className="space-y-6">
            {/* Step Header */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Load Strategy Configuration</h4>
                  <p className="text-sm text-blue-800">
                    Define how data should be extracted from your source. Choose between full loads (replace all data) or incremental loads (only new/changed records).
                  </p>
                </div>
              </div>
            </div>

            {/* Load Strategy Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <RefreshCw className="w-4 h-4 text-blue-600" />
                  Extraction Mode
                </CardTitle>
                <p className="text-xs text-foreground-muted mt-1">
                  Choose how data will be loaded from the source
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Load Strategy Type Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Load Option */}
                  {(() => {
                    const aiRecommendsFullLoad = fullAiAnalysis?.bronze?.incremental_load?.enabled === false
                    const isSelected = formData.type === 'file-based'
                      ? !formData.sourceConfig.fileConfig?.isIncremental
                      : !formData.sourceConfig.databaseConfig?.isIncremental

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (formData.type === 'file-based') {
                            updateSourceConfig({
                              fileConfig: {
                                ...formData.sourceConfig.fileConfig!,
                                isIncremental: false,
                                deltaColumn: ''
                              }
                            })
                          } else {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig!,
                                isIncremental: false,
                                deltaColumn: ''
                              }
                            })
                          }
                        }}
                        className={cn(
                          'p-4 border-2 rounded-lg text-left transition-all',
                          isSelected
                            ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                            : 'border-border hover:border-blue-300 hover:bg-blue-50/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                            <Database className="w-5 h-5 text-blue-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold text-foreground">Full Load</h4>
                              {aiRecommendsFullLoad ? (
                                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300">AI Recommended</Badge>
                              ) : !fullAiAnalysis?.success ? (
                                <Badge variant="default" className="text-xs">Default</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-foreground-muted leading-relaxed">
                              Replace all data on each run. Best for small to medium datasets or when complete refresh is needed.
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })()}

                  {/* Incremental Load Option */}
                  {(() => {
                    const aiRecommendsIncremental = fullAiAnalysis?.bronze?.incremental_load?.enabled === true
                    const aiWatermarkColumn = fullAiAnalysis?.bronze?.incremental_load?.watermark_column
                    const hasTemporalColumns = formData._detectedMetadata?.temporal_columns && formData._detectedMetadata.temporal_columns.length > 0
                    const isSelected = formData.type === 'file-based'
                      ? formData.sourceConfig.fileConfig?.isIncremental
                      : formData.sourceConfig.databaseConfig?.isIncremental

                    return (
                      <button
                        type="button"
                        onClick={() => {
                          // Use AI-recommended watermark column if available, otherwise first temporal column
                          const defaultDeltaColumn = aiWatermarkColumn || (formData._detectedMetadata?.temporal_columns?.[0] || '')

                          if (formData.type === 'file-based') {
                            updateSourceConfig({
                              fileConfig: {
                                ...formData.sourceConfig.fileConfig!,
                                isIncremental: true,
                                deltaColumn: defaultDeltaColumn
                              }
                            })
                          } else {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig!,
                                isIncremental: true,
                                deltaColumn: defaultDeltaColumn
                              }
                            })
                          }
                        }}
                        className={cn(
                          'p-4 border-2 rounded-lg text-left transition-all',
                          isSelected
                            ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                            : 'border-border hover:border-green-300 hover:bg-green-50/50'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-5 h-5 text-green-600" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-foreground">Incremental Load</h4>
                              {aiRecommendsIncremental ? (
                                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-300">AI Recommended</Badge>
                              ) : hasTemporalColumns ? (
                                <Badge variant="success" className="text-xs">Temporal Detected</Badge>
                              ) : null}
                            </div>
                            <p className="text-xs text-foreground-muted leading-relaxed">
                              Only load new or changed records based on a timestamp column. Best for large datasets with frequent updates.
                            </p>
                          </div>
                        </div>
                      </button>
                    )
                  })()}
                </div>

                {/* Incremental Configuration - Show when incremental is selected */}
                {((formData.type === 'file-based' && formData.sourceConfig.fileConfig?.isIncremental) ||
                  (formData.type === 'database' && formData.sourceConfig.databaseConfig?.isIncremental)) && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-900">Incremental Load Settings</span>
                    </div>

                    {/* Delta Column Selection */}
                    <FormField>
                      <FormLabel required>Delta/Watermark Column</FormLabel>
                      <Select
                        value={formData.type === 'file-based'
                          ? formData.sourceConfig.fileConfig?.deltaColumn || ''
                          : formData.sourceConfig.databaseConfig?.deltaColumn || ''
                        }
                        onChange={(e) => {
                          if (formData.type === 'file-based') {
                            updateSourceConfig({
                              fileConfig: {
                                ...formData.sourceConfig.fileConfig!,
                                deltaColumn: e.target.value
                              }
                            })
                          } else {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig!,
                                deltaColumn: e.target.value
                              }
                            })
                          }
                        }}
                      >
                        <option value="">Select a column...</option>
                        {/* Show AI-detected temporal columns first */}
                        {formData._detectedMetadata?.temporal_columns?.map((col: string) => (
                          <option key={col} value={col}>
                            {col} (AI Detected - Temporal)
                          </option>
                        ))}
                        {/* Show other columns that aren't temporal */}
                        {formData._detectedSchema?.filter(col =>
                          !formData._detectedMetadata?.temporal_columns?.includes(col.name)
                        ).map((col) => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </Select>
                      <p className="text-xs text-foreground-muted mt-1">
                        This column will be used to track which records have been processed. Typically a timestamp or auto-incrementing ID.
                      </p>
                    </FormField>

                    {/* Initial Watermark Value */}
                    <FormField>
                      <FormLabel>Initial Watermark Value</FormLabel>
                      <Input
                        value={formData.type === 'file-based'
                          ? (typeof formData.sourceConfig.fileConfig?.lastWatermark === 'string' ? formData.sourceConfig.fileConfig.lastWatermark : '') || ''
                          : (typeof formData.sourceConfig.databaseConfig?.lastWatermark === 'string' ? formData.sourceConfig.databaseConfig.lastWatermark : '') || ''
                        }
                        onChange={(e) => {
                          if (formData.type === 'file-based') {
                            updateSourceConfig({
                              fileConfig: {
                                ...formData.sourceConfig.fileConfig!,
                                lastWatermark: e.target.value
                              }
                            })
                          } else {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig!,
                                lastWatermark: e.target.value
                              }
                            })
                          }
                        }}
                        placeholder="e.g., 2024-01-01 or 0"
                      />
                      <p className="text-xs text-foreground-muted mt-1">
                        Leave empty to load all historical data on first run, or specify a starting point.
                      </p>
                    </FormField>
                  </div>
                )}

                {/* CDC Option - Coming Soon (hidden via feature flag) */}
                {featureFlags.showCDCOption && (
                  <div className="mt-4">
                    <button
                      type="button"
                      disabled
                      className="w-full p-4 border-2 border-dashed border-border rounded-lg text-left opacity-60 cursor-not-allowed"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
                          <Activity className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-foreground">Change Data Capture (CDC)</h4>
                            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                          </div>
                          <p className="text-xs text-foreground-muted leading-relaxed">
                            Real-time capture of inserts, updates, and deletes from the source system using database logs.
                          </p>
                        </div>
                      </div>
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Recommendations Preview */}
            {formData._detectedMetadata && (
              <Card className="border-green-200 bg-green-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Sparkles className="w-4 h-4 text-green-600" />
                    AI Analysis Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {formData._detectedMetadata.temporal_columns && formData._detectedMetadata.temporal_columns.length > 0 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-green-900 font-medium">
                          {formData._detectedMetadata.temporal_columns.length} temporal column(s) detected
                        </p>
                        <p className="text-xs text-green-700">
                          Suitable for incremental loading: {formData._detectedMetadata.temporal_columns.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {formData._detectedMetadata.pk_candidates && formData._detectedMetadata.pk_candidates.length > 0 && (
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-green-900 font-medium">
                          {formData._detectedMetadata.pk_candidates.length} primary key candidate(s) detected
                        </p>
                        <p className="text-xs text-green-700">
                          Can be used for deduplication: {formData._detectedMetadata.pk_candidates.join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  {(!formData._detectedMetadata.temporal_columns || formData._detectedMetadata.temporal_columns.length === 0) &&
                   (!formData._detectedMetadata.pk_candidates || formData._detectedMetadata.pk_candidates.length === 0) && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm text-amber-900 font-medium">
                          No temporal columns or primary keys detected
                        </p>
                        <p className="text-xs text-amber-700">
                          Full load is recommended for this data source.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )

      case 3: // Landing Zone Step (NEW)
        return (
          <div className="space-y-6">
            {/* Step Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <FolderOpen className="w-5 h-5 text-slate-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Landing Zone Configuration</h4>
                  <p className="text-sm text-slate-700">
                    Configure how raw source files are stored before processing. The landing zone preserves original files for audit, reprocessing, and disaster recovery. Use this when files are dropped externally (storage connections, scheduled feeds); manual UI uploads auto-handle landing with sensible defaults.
                  </p>
                </div>
              </div>
            </div>

            {/* Landing Zone Settings Card */}
            <Card className="border-slate-300">
              <CardHeader className="pb-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-slate-500 rounded-full"></div>
                    Landing Zone Settings
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">Raw File Storage</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-4">
                {/* Path Pattern */}
                <div className="space-y-3">
                  <FormLabel className="flex items-center gap-2">
                    <Folder className="w-4 h-4 text-slate-500" />
                    Storage Path Pattern
                  </FormLabel>
                  <Select
                    value={formData.destinationConfig.landingZoneConfig?.pathPattern || '/landing/{source_name}/{date:yyyy/MM/dd}/'}
                    onChange={(e) => updateFormData({
                      destinationConfig: {
                        ...formData.destinationConfig,
                        landingZoneConfig: {
                          ...formData.destinationConfig.landingZoneConfig,
                          pathPattern: e.target.value
                        }
                      }
                    })}
                  >
                    <option value="/landing/{source_name}/{date:yyyy/MM/dd}/">Date-Partitioned: /landing/{'{source_name}'}/{'{date:yyyy/MM/dd}'}/</option>
                    <option value="/landing/{source_name}/{date:yyyy}/{date:MM}/">Monthly: /landing/{'{source_name}'}/{'{yyyy}'}/{'{MM}'}/</option>
                    <option value="/landing/{source_name}/">Flat: /landing/{'{source_name}'}/</option>
                    <option value="/raw/{source_type}/{source_name}/{date:yyyy/MM/dd}/">By Source Type: /raw/{'{source_type}'}/{'{source_name}'}/{'{date}'}/</option>
                  </Select>
                  <p className="text-xs text-foreground-muted">
                    Pattern variables: {'{source_name}'} = source identifier, {'{date:format}'} = ingestion date, {'{source_type}'} = file/database/api
                  </p>
                </div>

                {/* File Organization */}
                <div className="space-y-3">
                  <FormLabel className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-500" />
                    File Organization Strategy
                  </FormLabel>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* Date-Partitioned Option */}
                    <button
                      type="button"
                      onClick={() => updateFormData({
                        destinationConfig: {
                          ...formData.destinationConfig,
                          landingZoneConfig: {
                            ...formData.destinationConfig.landingZoneConfig,
                            fileOrganization: 'date-partitioned'
                          }
                        }
                      })}
                      className={cn(
                        "p-3 border rounded-lg text-left transition-all",
                        formData.destinationConfig.landingZoneConfig?.fileOrganization === 'date-partitioned'
                          ? "border-slate-500 bg-slate-100 ring-2 ring-slate-300"
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-sm">Date-Partitioned</span>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Organize by ingestion date (yyyy/MM/dd). Best for time-series data.
                      </p>
                    </button>

                    {/* Source-Partitioned Option */}
                    <button
                      type="button"
                      onClick={() => updateFormData({
                        destinationConfig: {
                          ...formData.destinationConfig,
                          landingZoneConfig: {
                            ...formData.destinationConfig.landingZoneConfig,
                            fileOrganization: 'source-partitioned'
                          }
                        }
                      })}
                      className={cn(
                        "p-3 border rounded-lg text-left transition-all",
                        formData.destinationConfig.landingZoneConfig?.fileOrganization === 'source-partitioned'
                          ? "border-slate-500 bg-slate-100 ring-2 ring-slate-300"
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Server className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-sm">Source-Partitioned</span>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Organize by source system. Best for multi-source ingestion.
                      </p>
                    </button>

                    {/* Flat Option */}
                    <button
                      type="button"
                      onClick={() => updateFormData({
                        destinationConfig: {
                          ...formData.destinationConfig,
                          landingZoneConfig: {
                            ...formData.destinationConfig.landingZoneConfig,
                            fileOrganization: 'flat'
                          }
                        }
                      })}
                      className={cn(
                        "p-3 border rounded-lg text-left transition-all",
                        formData.destinationConfig.landingZoneConfig?.fileOrganization === 'flat'
                          ? "border-slate-500 bg-slate-100 ring-2 ring-slate-300"
                          : "border-border hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FolderOpen className="w-4 h-4 text-slate-600" />
                        <span className="font-medium text-sm">Flat</span>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        All files in single directory. Best for simple pipelines.
                      </p>
                    </button>
                  </div>
                </div>

                {/* Retention & Immutability Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Retention Days */}
                  <div className="space-y-3">
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-500" />
                      Retention Period (Days)
                    </FormLabel>
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={formData.destinationConfig.landingZoneConfig?.retentionDays || 30}
                      onChange={(e) => updateFormData({
                        destinationConfig: {
                          ...formData.destinationConfig,
                          landingZoneConfig: {
                            ...formData.destinationConfig.landingZoneConfig,
                            retentionDays: parseInt(e.target.value) || 30
                          }
                        }
                      })}
                      className="w-32"
                    />
                    <p className="text-xs text-foreground-muted">
                      Files older than this will be archived or deleted. Regulatory requirements may dictate minimum retention.
                    </p>
                  </div>

                  {/* Immutability Flag */}
                  <div className="space-y-3">
                    <FormLabel className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-slate-500" />
                      Immutability
                    </FormLabel>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => updateFormData({
                          destinationConfig: {
                            ...formData.destinationConfig,
                            landingZoneConfig: {
                              ...formData.destinationConfig.landingZoneConfig,
                              immutable: !formData.destinationConfig.landingZoneConfig?.immutable
                            }
                          }
                        })}
                        className={cn(
                          "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                          formData.destinationConfig.landingZoneConfig?.immutable
                            ? "bg-slate-600"
                            : "bg-gray-300"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            formData.destinationConfig.landingZoneConfig?.immutable
                              ? "translate-x-6"
                              : "translate-x-1"
                          )}
                        />
                      </button>
                      <span className="text-sm text-foreground">
                        {formData.destinationConfig.landingZoneConfig?.immutable ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="text-xs text-foreground-muted">
                      When enabled, files cannot be modified or deleted until retention expires. Required for compliance.
                    </p>
                  </div>
                </div>

                {/* Preview Path */}
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-slate-600" />
                    <span className="text-sm font-medium text-slate-700">Preview: Landing Zone Path</span>
                  </div>
                  <code className="text-xs text-slate-600 bg-slate-200 px-2 py-1 rounded block">
                    {(() => {
                      const sourceName = formData.name?.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '') || 'my_source'
                      const now = new Date()
                      const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
                      // Get filename from manual upload or storage connection selection
                      const filename = formData._uploadedFile?.name || selectedStorageFile?.name || formData.sourceConfig?.fileConfig?.filePath?.split(/[/\\]/).pop() || 'sample_file.csv'
                      return `landing/${sourceName}/${dateFolder}/{timestamp}_${filename}`
                    })()}
                  </code>
                  <p className="text-xs text-slate-500 mt-2">
                    Note: {'{timestamp}'} will be replaced with actual timestamp when the pipeline runs
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )

      case 4: // Bronze Layer (was case 3)
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
                <CardTitle className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                  Bronze Layer (Raw Data Ingestion)
                </CardTitle>
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

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsIngestionId || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsIngestionId: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_ingestion_id</code> - Unique ingestion identifier
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsLoadType || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsLoadType: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_load_type</code> - Load type (full/incremental/cdc)
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.bronzeConfig?.auditColumnsSchemaVersion || false}
                              onChange={(e) => updateDestinationConfig({
                                bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, auditColumnsSchemaVersion: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_schema_version</code> - Schema version at ingestion time
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </FormField>

                {/* Partitioning - Coming Soon (hidden via feature flag) */}
                {featureFlags.showPartitioningConfig && (
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
                )}

                {/* Schema Evolution - Coming Soon (hidden via feature flag) */}
                {featureFlags.showSchemaEvolution && (
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
                )}

                {/* Data Quality Checks - AI Suggested */}
                {aiSuggestions?.validation_hints?.suggested_rules && aiSuggestions.validation_hints.suggested_rules.length > 0 ? (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-900">AI-Suggested Quality Rules</span>
                        <Badge variant="default" className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                          {aiSuggestions.validation_hints.suggested_rules.length} Rules
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-purple-700 mb-3">
                      {aiSuggestions.validation_hints.reasoning || 'AI has analyzed your data and suggests these quality validation rules'}
                    </p>
                    <div className="space-y-2 mb-3">
                      {aiSuggestions.validation_hints.suggested_rules.slice(0, 3).map((rule: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-purple-800 bg-white/50 rounded p-2">
                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="font-medium">{rule.column}</span> - {rule.type}
                            {rule.reasoning && <span className="text-purple-600 ml-1">({rule.reasoning})</span>}
                          </div>
                        </div>
                      ))}
                      {aiSuggestions.validation_hints.suggested_rules.length > 3 && (
                        <div className="text-xs text-purple-600 ml-5">
                          + {aiSuggestions.validation_hints.suggested_rules.length - 3} more rules
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Store validation hints for later use in Quality Module
                        setFormData(prev => ({
                          ...prev,
                          _bronzeQualityRulesSuggestions: aiSuggestions.validation_hints.suggested_rules
                        }))
                        toast.info(`${aiSuggestions.validation_hints.suggested_rules.length} quality rules saved for Quality Module`, 3000)
                      }}
                      className="w-full text-xs h-8 border-purple-300 text-purple-700 hover:bg-purple-100"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Save Rules for Quality Module
                    </Button>
                    <p className="text-xs text-purple-600 mt-2 text-center">
                      For comprehensive validation rules, configure them in the Data Quality tab after source creation.
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">Basic Validation</Badge>
                      <span className="text-sm font-medium text-gray-900">Bronze Quality Checks</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-2">
                      Bronze layer performs minimal validation: schema conformance, required field checks, and row count monitoring.
                    </p>
                    <p className="text-xs text-gray-500">
                      For comprehensive data quality rules (null handling, type validation, deduplication), configure them in the <strong>Data Quality</strong> tab after source creation.
                    </p>
                  </div>
                )}

                {/* Load Mode Selection */}
                <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-semibold text-amber-900">Load Mode</span>
                  </div>
                  <p className="text-xs text-amber-700 mb-3">
                    Determines how data is written to the Bronze table. Bronze is your raw data audit log.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Append Mode - Recommended for Bronze */}
                    <button
                      type="button"
                      onClick={() => updateDestinationConfig({
                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, loadMode: 'append' }
                      })}
                      className={cn(
                        "p-3 border rounded-lg text-left transition-all",
                        formData.destinationConfig.bronzeConfig?.loadMode === 'append'
                          ? "border-amber-500 bg-amber-100 ring-2 ring-amber-300"
                          : "border-border hover:border-amber-300 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowRight className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-sm">Append</span>
                        <Badge variant="outline" className="text-xs ml-auto border-green-300 text-green-700 bg-green-50">Best Practice</Badge>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Preserve all ingested data as immutable audit log. Enables reprocessing and compliance.
                      </p>
                    </button>

                    {/* Overwrite Mode */}
                    <button
                      type="button"
                      onClick={() => updateDestinationConfig({
                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, loadMode: 'overwrite' }
                      })}
                      className={cn(
                        "p-3 border rounded-lg text-left transition-all",
                        formData.destinationConfig.bronzeConfig?.loadMode === 'overwrite'
                          ? "border-amber-500 bg-amber-100 ring-2 ring-amber-300"
                          : "border-border hover:border-amber-300 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <RefreshCw className="w-4 h-4 text-amber-600" />
                        <span className="font-medium text-sm">Overwrite</span>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Replace existing data each run. Use only when storage is limited or history not needed.
                      </p>
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 mt-2 italic">
                    Tip: Append mode preserves raw ingestion history for audit trails and reprocessing if Silver/Gold logic changes.
                  </p>
                </div>

                {/* Quarantine Configuration */}
                <div className="border border-red-200 rounded-lg p-4 bg-red-50/30">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600" />
                      <span className="text-sm font-semibold text-red-900">Error Quarantine</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newEnabled = !formData.destinationConfig.bronzeConfig?.quarantineEnabled
                        const tableName = formData.destinationConfig.bronzeConfig?.tableName || ''
                        updateDestinationConfig({
                          bronzeConfig: {
                            ...formData.destinationConfig.bronzeConfig!,
                            quarantineEnabled: newEnabled,
                            quarantineTableName: newEnabled ? `${tableName}_errors` : ''
                          }
                        })
                      }}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        formData.destinationConfig.bronzeConfig?.quarantineEnabled
                          ? "bg-red-500"
                          : "bg-gray-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          formData.destinationConfig.bronzeConfig?.quarantineEnabled
                            ? "translate-x-6"
                            : "translate-x-1"
                        )}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-red-700 mb-3">
                    Route failed records to a separate quarantine table instead of failing the entire batch
                  </p>
                  {formData.destinationConfig.bronzeConfig?.quarantineEnabled && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-700">Quarantine Table:</span>
                        <code className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded font-mono">
                          {formData.destinationConfig.bronzeConfig?.quarantineTableName || `${formData.destinationConfig.bronzeConfig?.tableName || 'bronze_table'}_errors`}
                        </code>
                      </div>
                      <div className="text-xs text-red-600 space-y-1">
                        <p className="font-medium">Records quarantined for:</p>
                        <ul className="list-disc list-inside ml-2 space-y-0.5">
                          <li>Schema mismatch (unexpected columns)</li>
                          <li>Type cast errors (invalid data types)</li>
                          <li>Mandatory field missing (null in required columns)</li>
                          <li>Corrupt data (malformed rows)</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column Mapping Section */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-900">Column Mapping (Landing → Bronze)</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">{formData._detectedSchema.length} Columns</Badge>
                    </div>
                    <p className="text-xs text-amber-700 mb-3">
                      Configure which columns to include, rename, or change data types. Excluded columns will not be ingested into Bronze.
                    </p>
                    <div className="max-h-64 overflow-y-auto border border-amber-200 rounded bg-white">
                      <table className="w-full text-xs">
                        <thead className="bg-amber-50 sticky top-0">
                          <tr>
                            <th className="text-left p-2 font-medium text-amber-900">Include</th>
                            <th className="text-left p-2 font-medium text-amber-900">Source Column</th>
                            <th className="text-left p-2 font-medium text-amber-900">Target Column</th>
                            <th className="text-left p-2 font-medium text-amber-900">Target Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100">
                          {formData._detectedSchema.map((col, idx) => {
                            const mapping = formData.destinationConfig.bronzeConfig?.columnMapping?.find(
                              m => m.sourceColumn === col.name
                            ) || { sourceColumn: col.name, targetColumn: col.name, targetType: col.type, exclude: false }

                            return (
                              <tr key={idx} className={cn(mapping.exclude && "bg-gray-50 opacity-60")}>
                                <td className="p-2">
                                  <input
                                    type="checkbox"
                                    checked={!mapping.exclude}
                                    onChange={(e) => {
                                      const currentMappings = formData.destinationConfig.bronzeConfig?.columnMapping || []
                                      const existingIndex = currentMappings.findIndex(m => m.sourceColumn === col.name)
                                      const newMapping = { ...mapping, exclude: !e.target.checked }

                                      let newMappings
                                      if (existingIndex >= 0) {
                                        newMappings = [...currentMappings]
                                        newMappings[existingIndex] = newMapping
                                      } else {
                                        newMappings = [...currentMappings, newMapping]
                                      }

                                      updateDestinationConfig({
                                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, columnMapping: newMappings }
                                      })
                                    }}
                                    className="w-4 h-4 text-amber-600 border-gray-300 rounded"
                                  />
                                </td>
                                <td className="p-2">
                                  <code className="font-mono text-amber-800">{col.name}</code>
                                  <span className="text-gray-400 ml-1">({col.type})</span>
                                </td>
                                <td className="p-2">
                                  <input
                                    type="text"
                                    value={mapping.targetColumn}
                                    onChange={(e) => {
                                      const currentMappings = formData.destinationConfig.bronzeConfig?.columnMapping || []
                                      const existingIndex = currentMappings.findIndex(m => m.sourceColumn === col.name)
                                      const newMapping = { ...mapping, targetColumn: e.target.value }

                                      let newMappings
                                      if (existingIndex >= 0) {
                                        newMappings = [...currentMappings]
                                        newMappings[existingIndex] = newMapping
                                      } else {
                                        newMappings = [...currentMappings, newMapping]
                                      }

                                      updateDestinationConfig({
                                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, columnMapping: newMappings }
                                      })
                                    }}
                                    disabled={mapping.exclude}
                                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded font-mono disabled:bg-gray-100"
                                  />
                                </td>
                                <td className="p-2">
                                  <select
                                    value={mapping.targetType}
                                    onChange={(e) => {
                                      const currentMappings = formData.destinationConfig.bronzeConfig?.columnMapping || []
                                      const existingIndex = currentMappings.findIndex(m => m.sourceColumn === col.name)
                                      const newMapping = { ...mapping, targetType: e.target.value }

                                      let newMappings
                                      if (existingIndex >= 0) {
                                        newMappings = [...currentMappings]
                                        newMappings[existingIndex] = newMapping
                                      } else {
                                        newMappings = [...currentMappings, newMapping]
                                      }

                                      updateDestinationConfig({
                                        bronzeConfig: { ...formData.destinationConfig.bronzeConfig!, columnMapping: newMappings }
                                      })
                                    }}
                                    disabled={mapping.exclude}
                                    className="w-full px-2 py-1 text-xs border border-gray-200 rounded disabled:bg-gray-100"
                                  >
                                    <option value="string">string</option>
                                    <option value="integer">integer</option>
                                    <option value="decimal">decimal</option>
                                    <option value="boolean">boolean</option>
                                    <option value="date">date</option>
                                    <option value="datetime">datetime</option>
                                    <option value="timestamp">timestamp</option>
                                  </select>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ Type casting errors will be routed to the quarantine table if enabled
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 5: // Silver Layer (was case 4)
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

                {/* Table Type Classification */}
                <FormField>
                  <FormLabel>Table Type</FormLabel>
                  <Select
                    value={formData.destinationConfig.silverConfig?.tableType || 'transactional'}
                    onChange={(e) => updateDestinationConfig({
                      silverConfig: { ...formData.destinationConfig.silverConfig!, tableType: e.target.value as any }
                    })}
                    disabled={formData.destinationConfig.silverConfig?.enabled === false}
                  >
                    <option value="transactional">Transactional (Events/Logs)</option>
                    <option value="dimension">Dimension (Master Data)</option>
                    <option value="fact">Fact (Metrics/Measures)</option>
                    <option value="reference">Reference (Lookup Data)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.silverConfig?.tableType === 'transactional' && 'Event-driven data like orders, clicks, or logs - typically append-only'}
                    {formData.destinationConfig.silverConfig?.tableType === 'dimension' && 'Master data like customers, products - ideal for SCD Type 2'}
                    {formData.destinationConfig.silverConfig?.tableType === 'fact' && 'Aggregated metrics and measures - typically used in Gold layer'}
                    {formData.destinationConfig.silverConfig?.tableType === 'reference' && 'Lookup tables like country codes, status types - rarely changes'}
                    {!formData.destinationConfig.silverConfig?.tableType && 'Event-driven data like orders, clicks, or logs - typically append-only'}
                  </p>
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
                    <option value="scd_type_2">SCD Type 2 (Historical Tracking)</option>
                  </Select>
                  <p className="text-xs text-foreground-muted mt-1">
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'merge' && 'Updates existing records and inserts new ones based on primary key'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'full_refresh' && 'Deletes all existing data and reloads from Bronze'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'append' && 'Adds all records without checking for duplicates'}
                    {formData.destinationConfig.silverConfig?.mergeStrategy === 'scd_type_2' && 'Tracks historical changes with effective dates'}
                  </p>
                </FormField>

                {/* SCD Type 2 Configuration - Dimension Tables Only */}
                {formData.destinationConfig.silverConfig?.mergeStrategy === 'scd_type_2' && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <div className="text-sm font-medium text-purple-900">SCD Type 2 Configuration</div>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200 text-[10px]">
                        Historical Tracking
                      </Badge>
                    </div>
                    <p className="text-xs text-purple-700">
                      Slowly Changing Dimension Type 2 tracks historical changes by creating new versions of records while preserving the full history.
                    </p>

                    {/* Natural Key Selection */}
                    <FormField>
                      <FormLabel className="text-xs text-purple-900">Natural Key (Business Identifier)</FormLabel>
                      <Select
                        value={Array.isArray(formData.destinationConfig.silverConfig?.scdNaturalKey)
                          ? formData.destinationConfig.silverConfig.scdNaturalKey[0] || ''
                          : ''}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: {
                            ...formData.destinationConfig.silverConfig!,
                            scdNaturalKey: e.target.value ? [e.target.value] : []
                          }
                        })}
                        className="text-xs"
                        disabled={formData.destinationConfig.silverConfig?.enabled === false}
                      >
                        <option value="">Select natural key...</option>
                        {formData._detectedSchema?.map(col => (
                          <option key={col.name} value={col.name}>
                            {col.name} ({col.type})
                          </option>
                        ))}
                      </Select>
                      <p className="text-[11px] text-purple-600 mt-1">
                        The business key that uniquely identifies the entity (e.g., customer_id, product_code)
                      </p>
                    </FormField>

                    {/* SCD Column Names */}
                    <div className="grid grid-cols-2 gap-3">
                      <FormField>
                        <FormLabel className="text-xs text-purple-900">Effective Date Column</FormLabel>
                        <Input
                          value={formData.destinationConfig.silverConfig?.scdEffectiveDateColumn || '_effective_from'}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, scdEffectiveDateColumn: e.target.value }
                          })}
                          placeholder="_effective_from"
                          className="text-xs h-8"
                          disabled={formData.destinationConfig.silverConfig?.enabled === false}
                        />
                      </FormField>
                      <FormField>
                        <FormLabel className="text-xs text-purple-900">End Date Column</FormLabel>
                        <Input
                          value={formData.destinationConfig.silverConfig?.scdEndDateColumn || '_effective_to'}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, scdEndDateColumn: e.target.value }
                          })}
                          placeholder="_effective_to"
                          className="text-xs h-8"
                          disabled={formData.destinationConfig.silverConfig?.enabled === false}
                        />
                      </FormField>
                    </div>

                    <FormField>
                      <FormLabel className="text-xs text-purple-900">Current Flag Column</FormLabel>
                      <Input
                        value={formData.destinationConfig.silverConfig?.scdCurrentFlagColumn || '_is_current'}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, scdCurrentFlagColumn: e.target.value }
                        })}
                        placeholder="_is_current"
                        className="text-xs h-8"
                        disabled={formData.destinationConfig.silverConfig?.enabled === false}
                      />
                      <p className="text-[11px] text-purple-600 mt-1">
                        Boolean column indicating if this is the current/active version of the record
                      </p>
                    </FormField>

                    {/* Track Deletes Option */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.destinationConfig.silverConfig?.scdTrackDeletes || false}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, scdTrackDeletes: e.target.checked }
                        })}
                        className="w-3 h-3 text-purple-600 border-purple-300 rounded focus:ring-purple-500"
                        disabled={formData.destinationConfig.silverConfig?.enabled === false}
                      />
                      <span className="text-xs text-purple-900">Track Soft Deletes</span>
                      <span className="text-[10px] text-purple-600">(Mark removed records as deleted instead of physically removing)</span>
                    </label>

                    {/* SCD Type 2 Info Box */}
                    <div className="bg-white/50 border border-purple-100 rounded p-2 mt-2">
                      <div className="text-[11px] text-purple-800 space-y-1">
                        <div className="font-medium">How SCD Type 2 Works:</div>
                        <ul className="list-disc list-inside space-y-0.5 text-purple-700">
                          <li>When a record changes, the current version is closed (end date set)</li>
                          <li>A new version is created with the updated values</li>
                          <li>Full history is preserved for point-in-time analysis</li>
                          <li>Query current records with: <code className="bg-purple-100 px-1 rounded">WHERE _is_current = true</code></li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Deduplication Configuration - AI-Powered */}
                {formData.destinationConfig.silverConfig?.mergeStrategy !== 'append' && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-xs font-medium text-foreground">Advanced Deduplication</div>
                        {formData.destinationConfig.silverConfig?._dedupEnabled && (
                          <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                            AI Applied
                          </Badge>
                        )}
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?._dedupEnabled || false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: {
                              ...formData.destinationConfig.silverConfig!,
                              _dedupEnabled: e.target.checked,
                              _dedupStrategy: e.target.checked ? (formData.destinationConfig.silverConfig?._dedupStrategy || 'last') : undefined,
                              _dedupSortColumn: e.target.checked ? formData.destinationConfig.silverConfig?._dedupSortColumn : undefined
                            }
                          })}
                          className="w-3 h-3 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                        <span className="text-[11px] font-medium text-foreground">Enable</span>
                      </label>
                    </div>

                    {formData.destinationConfig.silverConfig?._dedupEnabled && (
                      <>
                        <FormField>
                          <FormLabel className="text-xs">Deduplication Strategy</FormLabel>
                          <Select
                            value={formData.destinationConfig.silverConfig?._dedupStrategy || 'last'}
                            onChange={(e) => updateDestinationConfig({
                              silverConfig: { ...formData.destinationConfig.silverConfig!, _dedupStrategy: e.target.value as any }
                            })}
                            className="text-xs h-8"
                          >
                            <option value="first">Keep First Occurrence</option>
                            <option value="last">Keep Last Occurrence (Latest)</option>
                            <option value="none">Mark Duplicates (Keep All)</option>
                          </Select>
                          <p className="text-[11px] text-foreground-muted mt-1">
                            {formData.destinationConfig.silverConfig?._dedupStrategy === 'first' && 'Keep the first record encountered, discard later duplicates'}
                            {formData.destinationConfig.silverConfig?._dedupStrategy === 'last' && 'Keep the most recent record, discard earlier duplicates'}
                            {formData.destinationConfig.silverConfig?._dedupStrategy === 'none' && 'Flag duplicates but keep all records for manual review'}
                          </p>
                        </FormField>

                        {(formData.destinationConfig.silverConfig?._dedupStrategy === 'first' || formData.destinationConfig.silverConfig?._dedupStrategy === 'last') && (
                          <FormField>
                            <FormLabel className="text-xs">Sort Column (for ordering)</FormLabel>
                            <Select
                              value={formData.destinationConfig.silverConfig?._dedupSortColumn || ''}
                              onChange={(e) => updateDestinationConfig({
                                silverConfig: { ...formData.destinationConfig.silverConfig!, _dedupSortColumn: e.target.value }
                              })}
                              className="text-xs h-8"
                            >
                              <option value="">-- Select Column --</option>
                              {formData._detectedMetadata?.temporal_columns?.map((col: string) => (
                                <option key={col} value={col}>{col} (timestamp)</option>
                              ))}
                              {formData._detectedSchema?.filter((col: any) =>
                                !formData._detectedMetadata?.temporal_columns?.includes(col.name)
                              ).map((col: any) => (
                                <option key={col.name} value={col.name}>{col.name}</option>
                              ))}
                            </Select>
                            <p className="text-[11px] text-foreground-muted mt-1">
                              Column used to determine which record is {formData.destinationConfig.silverConfig?._dedupStrategy === 'first' ? 'first' : 'latest'}
                            </p>
                          </FormField>
                        )}
                      </>
                    )}

                    {!formData.destinationConfig.silverConfig?._dedupEnabled && (
                      <p className="text-xs text-blue-700">
                        💡 AI can suggest optimal deduplication strategy based on your data patterns. Apply Silver AI suggestions above.
                      </p>
                    )}
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

                {/* Column Transformations Grid */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-100/50 px-3 py-2 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Column Transformations ({formData._detectedSchema.length} columns)</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">Configure per column</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-gray-900">Source Column</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-900">Target Name</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-900">Type</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-900">Transform</th>
                            <th className="text-left px-3 py-2 font-medium text-gray-900 w-16">Nullable</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {formData._detectedSchema.map((col, idx) => {
                            const isExcludedFromBronze = (formData.destinationConfig.bronzeConfig as any)?.excludedColumns?.includes(col.name)
                            const colTransforms = (formData.destinationConfig.silverConfig as any)?.columnTransforms?.[col.name] || {}
                            if (isExcludedFromBronze) return null
                            return (
                              <tr key={idx} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2">
                                  <code className="font-mono text-gray-800">{col.name}</code>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={colTransforms.targetName || col.name}
                                    onChange={(e) => {
                                      const currentTransforms = (formData.destinationConfig.silverConfig as any)?.columnTransforms || {}
                                      updateDestinationConfig({
                                        silverConfig: {
                                          ...formData.destinationConfig.silverConfig!,
                                          columnTransforms: {
                                            ...currentTransforms,
                                            [col.name]: { ...currentTransforms[col.name], targetName: e.target.value }
                                          }
                                        } as any
                                      })
                                    }}
                                    className="h-7 text-xs font-mono"
                                    placeholder={col.name}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <Badge variant="secondary" className="text-xs font-mono">
                                    {col.type}
                                  </Badge>
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={colTransforms.transform || 'none'}
                                    onChange={(e) => {
                                      const currentTransforms = (formData.destinationConfig.silverConfig as any)?.columnTransforms || {}
                                      updateDestinationConfig({
                                        silverConfig: {
                                          ...formData.destinationConfig.silverConfig!,
                                          columnTransforms: {
                                            ...currentTransforms,
                                            [col.name]: { ...currentTransforms[col.name], transform: e.target.value }
                                          }
                                        } as any
                                      })
                                    }}
                                    className="h-7 px-2 text-xs rounded-md border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 hover:border-gray-300 transition-colors cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2020%2020%22%20fill%3D%22%236b7280%22%3E%3Cpath%20fill-rule%3D%22evenodd%22%20d%3D%22M5.23%207.21a.75.75%200%20011.06.02L10%2011.168l3.71-3.938a.75.75%200%20111.08%201.04l-4.25%204.5a.75.75%200%2001-1.08%200l-4.25-4.5a.75.75%200%20010-1.06z%22%20clip-rule%3D%22evenodd%22%2F%3E%3C%2Fsvg%3E')] bg-[length:16px_16px] bg-[right_4px_center] bg-no-repeat pr-6"
                                  >
                                    <option value="none">No Transform</option>
                                    <option value="trim">Trim Whitespace</option>
                                    <option value="lowercase">Lowercase</option>
                                    <option value="uppercase">Uppercase</option>
                                    {(col.type === 'string' || col.type === 'text') && (
                                      <>
                                        <option value="parse_date">Parse as Date</option>
                                        <option value="parse_number">Parse as Number</option>
                                      </>
                                    )}
                                    {col.type === 'date' && (
                                      <option value="iso8601">Format ISO 8601</option>
                                    )}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={colTransforms.nullable !== false}
                                    onChange={(e) => {
                                      const currentTransforms = (formData.destinationConfig.silverConfig as any)?.columnTransforms || {}
                                      updateDestinationConfig({
                                        silverConfig: {
                                          ...formData.destinationConfig.silverConfig!,
                                          columnTransforms: {
                                            ...currentTransforms,
                                            [col.name]: { ...currentTransforms[col.name], nullable: e.target.checked }
                                          }
                                        } as any
                                      })
                                    }}
                                    className="w-4 h-4 text-gray-600 border-gray-300 rounded focus:ring-gray-500"
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-gray-50/50 px-3 py-2 border-t border-gray-200 text-xs text-gray-600">
                      Rename columns, apply transformations, and configure nullable constraints
                    </div>
                  </div>
                )}

                {/* AI Transformation Recommendations */}
                {formData._detectedSchema && formData._detectedSchema.some(col => ['email', 'phone', 'date'].includes(col.type)) && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-900">AI Transformation Recommendations</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                    </div>
                    <div className="space-y-2 text-xs mb-3">
                      {formData._detectedSchema
                        .filter(col => ['email', 'phone', 'date'].includes(col.type))
                        .slice(0, 4)
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
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-purple-700 border-purple-300 hover:bg-purple-100 text-xs"
                      onClick={() => {
                        // Apply AI-suggested transformations
                        const transforms = { ...(formData.destinationConfig.silverConfig as any)?.columnTransforms || {} }
                        formData._detectedSchema?.forEach(col => {
                          if (col.type === 'email') {
                            transforms[col.name] = { ...transforms[col.name], transform: 'lowercase' }
                          } else if (col.type === 'date') {
                            transforms[col.name] = { ...transforms[col.name], transform: 'iso8601' }
                          }
                        })
                        updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, columnTransforms: transforms } as any
                        })
                        toast.success('AI transformation recommendations applied')
                      }}
                    >
                      Apply AI Recommendations
                    </Button>
                  </div>
                )}

                {/* Data Quality Rules - AI-Powered Quick-Add */}
                {silverAiSuggestions?.quality_rules?.suggested_rules && silverAiSuggestions.quality_rules.suggested_rules.length > 0 ? (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-semibold text-green-900">AI-Suggested Quality Rules</span>
                        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200 text-xs">
                          {silverAiSuggestions.quality_rules.suggested_rules.length} Rules
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-green-700 mb-3">
                      {silverAiSuggestions.quality_rules.reasoning || 'AI has analyzed your data and suggests these quality validation rules'}
                    </p>
                    <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                      {silverAiSuggestions.quality_rules.suggested_rules.map((rule: any, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-xs bg-white rounded p-2 border border-green-100">
                          <CheckCircle className="w-3 h-3 text-green-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-green-900">
                              <code className="bg-green-50 px-1.5 py-0.5 rounded text-[11px]">{rule.column}</code>
                              <span className="ml-2 text-green-700">{rule.type}</span>
                              {rule.severity && (
                                <Badge variant="secondary" className={`ml-2 text-[10px] ${
                                  rule.severity === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {rule.severity}
                                </Badge>
                              )}
                            </div>
                            {rule.parameters && Object.keys(rule.parameters).length > 0 && (
                              <div className="text-[11px] text-green-600 mt-1">
                                Parameters: {JSON.stringify(rule.parameters)}
                              </div>
                            )}
                            {rule.reasoning && (
                              <div className="text-[11px] text-green-700 mt-1 italic">
                                💡 {rule.reasoning}
                              </div>
                            )}
                            {rule.confidence && (
                              <div className="text-[10px] text-green-600 mt-1">
                                Confidence: {rule.confidence}%
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        onClick={() => {
                          // Store all quality rules for later use in Quality Module
                          setFormData(prev => ({
                            ...prev,
                            _silverQualityRulesApplied: true,
                            _silverQualityRulesSuggestions: silverAiSuggestions.quality_rules.suggested_rules
                          }))
                          toast.success(`All ${silverAiSuggestions.quality_rules.suggested_rules.length} quality rules saved for Quality Module`, 4000)
                        }}
                        className="flex-1 text-xs h-8 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                      >
                        <Sparkles className="w-3 h-3 mr-1" />
                        Quick Add All Rules
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({
                            ...prev,
                            _silverQualityRulesSuggestions: silverAiSuggestions.quality_rules.suggested_rules
                          }))
                          toast.info('Quality rules saved for manual review', 3000)
                        }}
                        className="flex-1 text-xs h-8 border-green-300 text-green-700 hover:bg-green-50"
                      >
                        Save for Manual Review
                      </Button>
                    </div>
                    {formData._silverQualityRulesApplied && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 rounded p-2">
                        <CheckCircle className="w-3 h-3" />
                        <span>Quality rules will be available in the Quality Module after source creation</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">AI Available</Badge>
                      <span className="text-sm font-medium text-gray-900">Data Quality Rules</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-2">
                      Apply Silver AI suggestions above to see recommended quality validation rules
                    </p>
                  </div>
                )}

                {/* Column Transformations - Basic Active */}
                <FormField>
                  <div className="flex items-center justify-between mb-2">
                    <FormLabel>Column Transformations</FormLabel>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.destinationConfig.silverConfig?.transformationsEnabled || false}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, transformationsEnabled: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        disabled={formData.destinationConfig.silverConfig?.enabled === false}
                      />
                      <span className="text-sm text-foreground">Enable</span>
                    </label>
                  </div>
                  <p className="text-xs text-foreground-muted mb-3">
                    Apply automatic transformations to clean and standardize data
                  </p>

                  {formData.destinationConfig.silverConfig?.transformationsEnabled && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                      <div className="text-xs font-medium text-foreground mb-2">Standard Transformations (Auto-Applied):</div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?.trimWhitespace !== false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, trimWhitespace: e.target.checked }
                          })}
                          className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                        />
                        <span className="text-xs text-foreground">
                          <strong>Trim Whitespace</strong> - Remove leading/trailing spaces from text columns
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?.normalizeNulls !== false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, normalizeNulls: e.target.checked }
                          })}
                          className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                        />
                        <span className="text-xs text-foreground">
                          <strong>Normalize Nulls</strong> - Convert empty strings, "NULL", "None" to proper NULL
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?.standardizeDates || false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, standardizeDates: e.target.checked }
                          })}
                          className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                        />
                        <span className="text-xs text-foreground">
                          <strong>Standardize Dates</strong> - Parse dates to ISO 8601 format (YYYY-MM-DD)
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?.lowercaseEmails || false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, lowercaseEmails: e.target.checked }
                          })}
                          className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                        />
                        <span className="text-xs text-foreground">
                          <strong>Lowercase Emails</strong> - Normalize email addresses to lowercase
                        </span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.destinationConfig.silverConfig?.standardizeBooleans || false}
                          onChange={(e) => updateDestinationConfig({
                            silverConfig: { ...formData.destinationConfig.silverConfig!, standardizeBooleans: e.target.checked }
                          })}
                          className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                        />
                        <span className="text-xs text-foreground">
                          <strong>Standardize Booleans</strong> - Convert yes/no/1/0/true/false to boolean
                        </span>
                      </label>

                      {featureFlags.showSilverComingSoon && (
                        <div className="border-t border-gray-200 pt-3 mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                            <span className="text-xs font-medium text-gray-700">Advanced Transformations</span>
                          </div>
                          <div className="space-y-1 text-xs text-gray-500 ml-2">
                            <div>• Phone number formatting (international)</div>
                            <div>• Currency rounding to 2 decimals</div>
                            <div>• Custom regex replacements</div>
                            <div>• Derived columns with SQL expressions</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </FormField>

                {/* Silver Audit Columns */}
                <FormField>
                  <div className="flex items-center justify-between mb-2">
                    <FormLabel>Silver Audit Columns</FormLabel>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.destinationConfig.silverConfig?.auditColumnsEnabled !== false}
                        onChange={(e) => updateDestinationConfig({
                          silverConfig: { ...formData.destinationConfig.silverConfig!, auditColumnsEnabled: e.target.checked }
                        })}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        disabled={formData.destinationConfig.silverConfig?.enabled === false}
                      />
                      <span className="text-sm text-foreground">Enable</span>
                    </label>
                  </div>
                  <p className="text-xs text-foreground-muted mb-3">
                    Track record lineage and changes in the Silver layer
                  </p>

                  {formData.destinationConfig.silverConfig?.auditColumnsEnabled !== false && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="text-xs font-medium text-foreground mb-2">Standard Audit Columns (Always Added):</div>
                      <div className="space-y-1 text-xs text-foreground-muted ml-2">
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_created_at</code> - When record was first created in Silver</div>
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_updated_at</code> - When record was last updated</div>
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_load_id</code> - Ingestion identifier</div>
                      </div>

                      <div className="border-t border-gray-200 pt-2 mt-3">
                        <div className="text-xs font-medium text-foreground mb-2">Additional Audit Columns:</div>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.silverConfig?.auditSourceSystem || false}
                              onChange={(e) => updateDestinationConfig({
                                silverConfig: { ...formData.destinationConfig.silverConfig!, auditSourceSystem: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_source_system</code> - Origin system name
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.silverConfig?.auditChangeType || false}
                              onChange={(e) => updateDestinationConfig({
                                silverConfig: { ...formData.destinationConfig.silverConfig!, auditChangeType: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_change_type</code> - INSERT/UPDATE/DELETE indicator
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.silverConfig?.auditRecordHash || false}
                              onChange={(e) => updateDestinationConfig({
                                silverConfig: { ...formData.destinationConfig.silverConfig!, auditRecordHash: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_record_hash</code> - Hash of record for change detection
                            </span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.destinationConfig.silverConfig?.auditIsCurrent || false}
                              onChange={(e) => updateDestinationConfig({
                                silverConfig: { ...formData.destinationConfig.silverConfig!, auditIsCurrent: e.target.checked }
                              })}
                              className="w-3.5 h-3.5 text-primary border-gray-300 rounded"
                            />
                            <span className="text-xs text-foreground">
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_is_current</code> - Flag for current version (for SCD)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </FormField>

                {/* Silver Layer Coming Soon Features - Hidden by default for cleaner demo */}
                {featureFlags.showSilverComingSoon && (
                  <>
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

                    {/* Reference Data Enrichment - Coming Soon */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        <span className="text-sm font-medium text-blue-900">Reference Data Enrichment (Lookup Joins)</span>
                      </div>
                      <p className="text-xs text-blue-700 mb-2">
                        Improve data quality by enriching records with lookup/reference data
                      </p>
                      <div className="space-y-1 text-xs text-blue-700 ml-2">
                        <div>• <strong>Purpose:</strong> Add missing descriptive data for completeness</div>
                        <div>• Lookup joins to small reference tables (countries, states, categories)</div>
                        <div>• Example: country_code "US" → country_name "United States"</div>
                        <div>• Left outer join with configurable null handling</div>
                        <div>• Caching for frequently used lookups</div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2 italic">
                        Note: For analytics-ready wide tables with multi-table joins, use Gold Layer Denormalization
                      </p>
                    </div>

                    {/* Schema Drift Handling - Coming Soon */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        <span className="text-sm font-medium text-blue-900">Schema Drift Handling</span>
                      </div>
                      <p className="text-xs text-blue-700 mb-2">
                        Handle schema changes automatically when source structure evolves
                      </p>
                      <div className="space-y-1 text-xs text-blue-700 ml-2">
                        <div>• Detect new columns from source</div>
                        <div>• Track removed/deprecated columns</div>
                        <div>• Handle type changes with warnings</div>
                        <div>• Schema version tracking</div>
                        <div>• Breaking change alerts</div>
                      </div>
                    </div>

                    {/* Error Handling & Quarantine - Coming Soon */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        <span className="text-sm font-medium text-blue-900">Error Handling & Quarantine</span>
                      </div>
                      <p className="text-xs text-blue-700 mb-2">
                        Capture and manage invalid records for review
                      </p>
                      <div className="space-y-1 text-xs text-blue-700 ml-2">
                        <div>• Quarantine zone for invalid records</div>
                        <div>• Error categorization (invalid email, null key, duplicate)</div>
                        <div>• Manual fix and reprocess workflow</div>
                        <div>• Suggested remediation actions</div>
                      </div>
                    </div>

                    {/* Data Quality Gate - Coming Soon */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                        <span className="text-sm font-medium text-blue-900">Data Quality Gate</span>
                      </div>
                      <p className="text-xs text-blue-700 mb-2">
                        Validate data before promotion to Gold layer
                      </p>
                      <div className="space-y-1 text-xs text-blue-700 ml-2">
                        <div>• Mandatory fields populated check</div>
                        <div>• Referential integrity validation</div>
                        <div>• Null spike detection</div>
                        <div>• Value range checks</div>
                        <div>• Record count variance threshold</div>
                        <div>• Block promotion on failure with alerts</div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 6: // Gold Layer (was case 5)
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
                      value={formData.destinationConfig.goldConfig?.storageFormat || 'duckdb'}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, storageFormat: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.goldConfig?.enabled === false}
                    >
                      <option value="duckdb">DuckDB (Analytics Database)</option>
                      <option value="parquet">Parquet (File-based)</option>
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

                {/* Table Type (Dimension/Fact) */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField>
                    <FormLabel>Table Type</FormLabel>
                    <Select
                      value={(formData.destinationConfig.goldConfig as any)?.tableType || 'fact'}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, tableType: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.goldConfig?.enabled === false}
                    >
                      <option value="fact">Fact Table (Transactional/Events)</option>
                      <option value="dimension">Dimension Table (Reference/Lookup)</option>
                    </Select>
                    <p className="text-xs text-foreground-muted mt-1">
                      {(formData.destinationConfig.goldConfig as any)?.tableType === 'dimension' && 'Descriptive attributes for analysis (e.g., Customer, Product)'}
                      {((formData.destinationConfig.goldConfig as any)?.tableType === 'fact' || !(formData.destinationConfig.goldConfig as any)?.tableType) && 'Measurable events/transactions (e.g., Sales, Payments)'}
                    </p>
                  </FormField>

                  {/* Materialization Type */}
                  <FormField>
                    <FormLabel>Materialization</FormLabel>
                    <Select
                      value={formData.destinationConfig.goldConfig?.materializationType || 'table'}
                      onChange={(e) => updateDestinationConfig({
                        goldConfig: { ...formData.destinationConfig.goldConfig!, materializationType: e.target.value as any }
                      })}
                      disabled={formData.destinationConfig.goldConfig?.enabled === false}
                    >
                      <option value="table">Table (Physical Storage)</option>
                      <option value="view" disabled>View (Coming Soon)</option>
                      <option value="materialized_view" disabled>Materialized View (Coming Soon)</option>
                    </Select>
                  </FormField>
                </div>

                {/* AI Table Type Recommendation */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        <span className="text-sm font-semibold text-purple-900">AI Recommendation</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">Optional</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-purple-800">
                        Based on schema analysis, this appears to be a{' '}
                        <strong>
                          {formData._detectedSchema.some(col =>
                            col.name.toLowerCase().includes('amount') ||
                            col.name.toLowerCase().includes('quantity') ||
                            col.name.toLowerCase().includes('payment') ||
                            col.name.toLowerCase().includes('transaction')
                          ) ? 'Fact Table' : 'Dimension Table'}
                        </strong>
                      </p>
                      <div className="text-xs text-purple-700 space-y-1">
                        {formData._detectedSchema.some(col =>
                          col.name.toLowerCase().includes('amount') ||
                          col.name.toLowerCase().includes('quantity')
                        ) ? (
                          <>
                            <p>• Contains numeric measures (amount, quantity)</p>
                            <p>• Has temporal columns for time-series analysis</p>
                            <p>• Suitable for aggregations and metrics</p>
                          </>
                        ) : (
                          <>
                            <p>• Contains descriptive attributes</p>
                            <p>• Has unique identifiers (ID columns)</p>
                            <p>• Suitable as reference/lookup data</p>
                          </>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 text-purple-700 border-purple-300 hover:bg-purple-100"
                        onClick={() => {
                          const suggestedType = formData._detectedSchema?.some(col =>
                            col.name.toLowerCase().includes('amount') ||
                            col.name.toLowerCase().includes('quantity') ||
                            col.name.toLowerCase().includes('payment') ||
                            col.name.toLowerCase().includes('transaction')
                          ) ? 'fact' : 'dimension'
                          updateDestinationConfig({
                            goldConfig: { ...formData.destinationConfig.goldConfig!, tableType: suggestedType as any }
                          })
                        }}
                      >
                        Apply Recommendation
                      </Button>
                    </div>
                  </div>
                )}

                {/* Gold Column Schema Grid */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (
                  <div className="border border-yellow-200 rounded-lg overflow-hidden">
                    <div className="bg-yellow-100/50 px-3 py-2 border-b border-yellow-200">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-yellow-900">
                          Gold Layer Column Configuration ({formData._detectedSchema.filter(col => {
                            const isExcludedBronze = (formData.destinationConfig.bronzeConfig as any)?.excludedColumns?.includes(col.name)
                            const isExcludedGold = (formData.destinationConfig.goldConfig as any)?.excludedColumns?.includes(col.name)
                            return !isExcludedBronze && !isExcludedGold
                          }).length} columns)
                        </span>
                        <Badge variant="secondary" className="text-xs">Business-Ready Naming</Badge>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-yellow-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2 font-medium text-yellow-900 w-10">Include</th>
                            <th className="text-left px-3 py-2 font-medium text-yellow-900">Source Column</th>
                            <th className="text-left px-3 py-2 font-medium text-yellow-900">Business Name</th>
                            <th className="text-left px-3 py-2 font-medium text-yellow-900 w-24">Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-yellow-100">
                          {formData._detectedSchema.map((col, idx) => {
                            const isExcludedFromBronze = (formData.destinationConfig.bronzeConfig as any)?.excludedColumns?.includes(col.name)
                            const isExcludedFromGold = (formData.destinationConfig.goldConfig as any)?.excludedColumns?.includes(col.name)
                            const goldColConfig = (formData.destinationConfig.goldConfig as any)?.columnConfig?.[col.name] || {}

                            // Skip columns excluded from Bronze
                            if (isExcludedFromBronze) return null

                            return (
                              <tr key={idx} className={cn(
                                "hover:bg-yellow-50/50",
                                isExcludedFromGold && "opacity-50 bg-gray-50"
                              )}>
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={!isExcludedFromGold}
                                    onChange={(e) => {
                                      const currentExcluded = (formData.destinationConfig.goldConfig as any)?.excludedColumns || []
                                      const newExcluded = e.target.checked
                                        ? currentExcluded.filter((c: string) => c !== col.name)
                                        : [...currentExcluded, col.name]
                                      updateDestinationConfig({
                                        goldConfig: { ...formData.destinationConfig.goldConfig!, excludedColumns: newExcluded } as any
                                      })
                                    }}
                                    className="w-4 h-4 text-yellow-600 border-gray-300 rounded focus:ring-yellow-500"
                                    disabled={formData.destinationConfig.goldConfig?.enabled === false}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <code className="font-mono text-yellow-800 text-xs">{col.name}</code>
                                </td>
                                <td className="px-3 py-2">
                                  <Input
                                    value={goldColConfig.businessName || col.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                    onChange={(e) => {
                                      const currentConfig = (formData.destinationConfig.goldConfig as any)?.columnConfig || {}
                                      updateDestinationConfig({
                                        goldConfig: {
                                          ...formData.destinationConfig.goldConfig!,
                                          columnConfig: {
                                            ...currentConfig,
                                            [col.name]: { ...currentConfig[col.name], businessName: e.target.value }
                                          }
                                        } as any
                                      })
                                    }}
                                    className="h-7 text-xs"
                                    placeholder={col.name}
                                    disabled={formData.destinationConfig.goldConfig?.enabled === false || isExcludedFromGold}
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <span className="text-xs text-yellow-700">{col.type}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="bg-yellow-50 px-3 py-2 border-t border-yellow-200 text-xs text-yellow-700">
                      <div className="flex items-center justify-between">
                        <span>
                          <strong>Tip:</strong> Business names appear in reports and dashboards for better readability.
                        </span>
                        {formData._detectedSchema && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="text-xs h-6 text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                            onClick={() => {
                              // Apply AI-suggested business names
                              const newConfig: Record<string, any> = {}
                              formData._detectedSchema?.forEach(col => {
                                const nameLower = col.name.toLowerCase()
                                let businessName = col.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())

                                // Smart business name transformations
                                businessName = businessName
                                  .replace(/\bId\b/g, 'ID')
                                  .replace(/\bDti\b/g, 'DTI')
                                  .replace(/\bLtv\b/g, 'LTV')
                                  .replace(/\bApi\b/g, 'API')

                                // Detect role
                                let role = 'dimension_attribute'
                                if (nameLower.endsWith('_id') || nameLower === 'id') role = 'dimension_key'
                                else if (col.type === 'number' || col.type === 'integer') {
                                  if (nameLower.includes('amount') || nameLower.includes('quantity') || nameLower.includes('rate') || nameLower.includes('value') || nameLower.includes('payment') || nameLower.includes('income') || nameLower.includes('score')) role = 'measure'
                                }
                                else if (col.type === 'date' || col.type === 'datetime' || nameLower.includes('date') || nameLower.includes('_at')) role = 'date_dimension'

                                newConfig[col.name] = {
                                  businessName,
                                  role,
                                  aggregation: role === 'measure' ? 'sum' : undefined
                                }
                              })

                              updateDestinationConfig({
                                goldConfig: {
                                  ...formData.destinationConfig.goldConfig!,
                                  columnConfig: newConfig
                                } as any
                              })
                            }}
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            Apply AI Naming
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* AI Aggregations Preview */}
                {formData._detectedSchema && formData._detectedSchema.length > 0 && (formData.destinationConfig.goldConfig as any)?.tableType === 'fact' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-900">AI-Suggested Aggregations</span>
                      <Badge variant="secondary" className="text-xs ml-auto">Optional</Badge>
                    </div>
                    <div className="space-y-2 text-xs">
                      {formData._detectedSchema
                        .filter(col => col.type === 'number' || col.type === 'integer')
                        .slice(0, 3)
                        .map((col, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-green-800">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            <code className="font-mono bg-white px-1.5 py-0.5 rounded">{col.name}</code>
                            <span>→</span>
                            <span className="text-green-700">SUM, AVG, COUNT by date/category</span>
                          </div>
                        ))}
                      {formData._detectedSchema.filter(col => col.type === 'number' || col.type === 'integer').length === 0 && (
                        <p className="text-green-700">No numeric columns detected for aggregation</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Gold Layer Coming Soon Cards - Feature Flagged */}
                {featureFlags.showGoldComingSoon && (
                  <>
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
                        <span className="text-sm font-medium text-blue-900">Denormalization (Multi-Table Joins)</span>
                      </div>
                      <p className="text-xs text-blue-700 mb-2">
                        Create wide, analytics-ready tables optimized for BI and reporting
                      </p>
                      <div className="space-y-1 text-xs text-blue-700 ml-2">
                        <div>• <strong>Purpose:</strong> Pre-join tables to eliminate runtime joins in BI tools</div>
                        <div>• Join multiple Silver tables (orders + customers + products → fct_sales)</div>
                        <div>• Star/snowflake schema creation with fact and dimension tables</div>
                        <div>• Join types: INNER, LEFT, RIGHT, FULL OUTER</div>
                        <div>• Column selection and automatic dimension flattening</div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2 italic">
                        Note: For simple lookup enrichment (e.g., adding country names), use Silver Layer Reference Data Enrichment
                      </p>
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
                        <div>• Schedule: On source completion, Daily, Weekly</div>
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
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 7: // Review & Create (was case 6)
        return (
          <div className="space-y-6">
            <div className="text-sm font-medium text-foreground mb-2">
              Review Configuration
            </div>
            <div className="text-sm text-foreground-muted mb-4">
              Review your source configuration before creating
            </div>

            {/* AI Data Architect - Senior Architect Review */}
            <Card className={cn(
              "border-2 transition-all",
              aiArchitectReview
                ? aiArchitectReview.overallScore >= 80
                  ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50"
                  : aiArchitectReview.overallScore >= 60
                    ? "border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50"
                    : "border-red-300 bg-gradient-to-r from-red-50 to-orange-50"
                : "border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50"
            )}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      aiArchitectReview
                        ? aiArchitectReview.overallScore >= 80
                          ? "bg-green-100"
                          : aiArchitectReview.overallScore >= 60
                            ? "bg-yellow-100"
                            : "bg-red-100"
                        : "bg-purple-100"
                    )}>
                      <Sparkles className={cn(
                        "w-5 h-5",
                        aiArchitectReview
                          ? aiArchitectReview.overallScore >= 80
                            ? "text-green-600"
                            : aiArchitectReview.overallScore >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                          : "text-purple-600"
                      )} />
                    </div>
                    <div>
                      <span className="text-foreground">AI Data Architect</span>
                      <p className="text-xs font-normal text-foreground-muted mt-0.5">
                        Senior Data Architect Review
                      </p>
                    </div>
                  </CardTitle>
                  {!aiArchitectReview && !isLoadingAiReview && (
                    <Button
                      type="button"
                      onClick={fetchAiArchitectReview}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Review with AI
                    </Button>
                  )}
                  {aiArchitectReview && (
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        "text-sm px-3 py-1",
                        aiArchitectReview.overallScore >= 80 ? "bg-green-100 text-green-700 border-green-300" :
                        aiArchitectReview.overallScore >= 60 ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
                        "bg-red-100 text-red-700 border-red-300"
                      )}>
                        Score: {aiArchitectReview.overallScore}/100
                      </Badge>
                      <Button
                        type="button"
                        onClick={fetchAiArchitectReview}
                        variant="outline"
                        size="sm"
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Re-review
                      </Button>
                    </div>
                  )}
                </div>
                {!aiArchitectReview && !isLoadingAiReview && (
                  <p className="text-sm text-purple-700 mt-2">
                    Have our AI Senior Data Architect review your configuration and identify potential issues with load strategy,
                    data quality rules, partitioning, and layer-specific settings.
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {isLoadingAiReview && (
                  <div className="py-6 space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-purple-700 font-medium">{aiAnalysisStage || 'Reviewing your configuration...'}</span>
                      <span className="text-purple-600 font-mono">{aiAnalysisProgress}%</span>
                    </div>
                    <div className="w-full bg-purple-100 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-purple-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${aiAnalysisProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-purple-500">
                      Analyzing load strategy, Bronze/Silver/Gold configurations, data quality rules, and best practices...
                    </p>
                  </div>
                )}

                {aiReviewError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span>{aiReviewError}</span>
                    </div>
                  </div>
                )}

                {aiArchitectReview && (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="text-sm text-purple-800 bg-white/50 rounded-lg p-3">
                      {aiArchitectReview.summary}
                    </div>

                    {/* Risk Flags */}
                    {aiArchitectReview.riskFlags.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-red-700 uppercase tracking-wide flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Risk Flags ({aiArchitectReview.riskFlags.length})
                        </div>
                        {aiArchitectReview.riskFlags.map((flag, idx) => (
                          <div key={idx} className={cn(
                            "rounded-lg p-3 text-sm",
                            flag.severity === 'high' ? "bg-red-50 border border-red-200" :
                            flag.severity === 'medium' ? "bg-yellow-50 border border-yellow-200" :
                            "bg-blue-50 border border-blue-200"
                          )}>
                            <div className="flex items-start gap-2">
                              <Badge className={cn(
                                "text-xs shrink-0",
                                flag.severity === 'high' ? "bg-red-100 text-red-700" :
                                flag.severity === 'medium' ? "bg-yellow-100 text-yellow-700" :
                                "bg-blue-100 text-blue-700"
                              )}>
                                {flag.severity.toUpperCase()}
                              </Badge>
                              <div>
                                <p className="font-medium">{flag.message}</p>
                                <p className="text-xs mt-1 opacity-80">{flag.recommendation}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recommendations by Layer */}
                    {(aiArchitectReview.bronzeRecommendations.length > 0 ||
                      aiArchitectReview.silverRecommendations.length > 0 ||
                      aiArchitectReview.goldRecommendations.length > 0) && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
                            Recommendations
                          </div>
                          <Button
                            type="button"
                            onClick={applyAllAiRecommendations}
                            size="sm"
                            className="text-xs bg-purple-600 hover:bg-purple-700"
                          >
                            Apply All
                          </Button>
                        </div>

                        {/* Bronze Recommendations */}
                        {aiArchitectReview.bronzeRecommendations.length > 0 && (
                          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                              <span className="text-xs font-semibold text-amber-900">Bronze Layer</span>
                            </div>
                            <div className="space-y-2">
                              {aiArchitectReview.bronzeRecommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                  <div className="flex-1">
                                    <span className="font-medium">{rec.field}:</span>{' '}
                                    <span className="text-gray-500">{String(rec.currentValue)}</span>
                                    <span className="mx-1">→</span>
                                    <span className="text-amber-700 font-medium">{String(rec.suggestedValue)}</span>
                                    <p className="text-gray-500 mt-0.5">{rec.reasoning}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={() => applyAiRecommendation('bronze', idx)}
                                    disabled={rec.applied}
                                    size="sm"
                                    variant="outline"
                                    className={cn("text-xs ml-2 shrink-0", rec.applied && "bg-green-50 text-green-600")}
                                  >
                                    {rec.applied ? '✓ Applied' : 'Apply'}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Silver Recommendations */}
                        {aiArchitectReview.silverRecommendations.length > 0 && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                              <span className="text-xs font-semibold text-gray-900">Silver Layer</span>
                            </div>
                            <div className="space-y-2">
                              {aiArchitectReview.silverRecommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                  <div className="flex-1">
                                    <span className="font-medium">{rec.field}:</span>{' '}
                                    <span className="text-gray-500">{String(rec.currentValue)}</span>
                                    <span className="mx-1">→</span>
                                    <span className="text-gray-700 font-medium">{String(rec.suggestedValue)}</span>
                                    <p className="text-gray-500 mt-0.5">{rec.reasoning}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={() => applyAiRecommendation('silver', idx)}
                                    disabled={rec.applied}
                                    size="sm"
                                    variant="outline"
                                    className={cn("text-xs ml-2 shrink-0", rec.applied && "bg-green-50 text-green-600")}
                                  >
                                    {rec.applied ? '✓ Applied' : 'Apply'}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Gold Recommendations */}
                        {aiArchitectReview.goldRecommendations.length > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                              <span className="text-xs font-semibold text-yellow-900">Gold Layer</span>
                            </div>
                            <div className="space-y-2">
                              {aiArchitectReview.goldRecommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-center justify-between text-xs bg-white rounded p-2">
                                  <div className="flex-1">
                                    <span className="font-medium">{rec.field}:</span>{' '}
                                    <span className="text-gray-500">{String(rec.currentValue)}</span>
                                    <span className="mx-1">→</span>
                                    <span className="text-yellow-700 font-medium">{String(rec.suggestedValue)}</span>
                                    <p className="text-gray-500 mt-0.5">{rec.reasoning}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    onClick={() => applyAiRecommendation('gold', idx)}
                                    disabled={rec.applied}
                                    size="sm"
                                    variant="outline"
                                    className={cn("text-xs ml-2 shrink-0", rec.applied && "bg-green-50 text-green-600")}
                                  >
                                    {rec.applied ? '✓ Applied' : 'Apply'}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {aiArchitectReview.riskFlags.length === 0 &&
                      aiArchitectReview.bronzeRecommendations.length === 0 &&
                      aiArchitectReview.silverRecommendations.length === 0 &&
                      aiArchitectReview.goldRecommendations.length === 0 && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 rounded-lg p-3">
                        <CheckCircle className="w-5 h-5" />
                        <span className="text-sm font-medium">Excellent! Your configuration looks good.</span>
                      </div>
                    )}
                  </div>
                )}

                {!isLoadingAiReview && !aiArchitectReview && !aiReviewError && (
                  <div className="text-center py-6 text-sm text-purple-600">
                    <p>Click "Review with AI" to get expert recommendations on your configuration</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Source Details</CardTitle>
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
                      Your source is configured and ready to process <strong>{formData._detectedSchema.length} columns</strong> through the medallion architecture.
                      {mode === 'edit' ? ' Click "Save Changes" to update this source.' : ' Click "Create Source" to add this source to your pipeline.'}
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
    <>
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? 'Edit Source' : cloningJob ? 'Clone Source' : 'Create New Source'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update source configuration and settings'
              : cloningJob
                ? 'Create a new source based on existing configuration'
                : 'Configure a new data source for your pipeline'}
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
              {currentStep < 7 ? (
                <Button onClick={nextStep} disabled={!isStepValid(currentStep)}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!isStepValid(currentStep)}>
                  {mode === 'edit' ? 'Save Changes' : 'Create Source'}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <CreateConnectionModal
      open={isCreatingConnection}
      onOpenChange={setIsCreatingConnection}
      onConnectionCreated={(connection) => {
        fetchConnections()
        handleConnectionSelect(connection.id)
      }}
    />

    {/* Unified AI Analysis Modal */}
    <FullAnalysisModal
      isOpen={showAIModal}
      isAnalyzing={isAnalyzingAI}
      result={fullAiAnalysis}
      error={aiAnalysisError}
      onAccept={handleAcceptAIRecommendations}
      onDiscard={handleDiscardAIRecommendations}
      onClose={() => setShowAIModal(false)}
    />

    <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
  </>
  )
}
