'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { StorageConnection, StorageFile } from '@/types/storage-connection'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield, AlertCircle, Eye, HardDrive, Sparkles, Activity, Clock, Key, Mail, Phone, Globe, RefreshCw, Layers, FolderOpen, Server, Folder } from 'lucide-react'
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
  { id: 1, title: 'Select Source', description: 'Choose data source and configure connection', icon: Upload },
  { id: 2, title: 'Load Strategy', description: 'Define extraction mode and incremental settings', icon: RefreshCw },
  { id: 3, title: 'Bronze Layer', description: 'Configure raw data landing zone', icon: Layers },
  { id: 4, title: 'Silver Layer', description: 'Configure cleaned & validated data', icon: Shield },
  { id: 5, title: 'Gold Layer', description: 'Configure analytics-ready data', icon: Sparkles },
  { id: 6, title: 'Review & Create', description: 'Review configuration and create job', icon: CheckCircle }
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
      setFormData({
        name: editingJob.name,
        description: editingJob.description || '',
        type: editingJob.type,
        order: editingJob.order,
        sourceConfig: editingJob.sourceConfig,
        destinationConfig: editingJob.destinationConfig,
        transformationConfig: editingJob.transformationConfig,
        validationConfig: editingJob.validationConfig
      })
      setCurrentStep(1)
    } else if (cloningJob && open) {
      // When cloning, pre-fill data with modified name
      const clonedName = `${cloningJob.name} (Copy)`
      setFormData({
        name: clonedName,
        description: cloningJob.description || '',
        type: cloningJob.type,
        order: cloningJob.order + 1, // Increment order for the clone
        sourceConfig: cloningJob.sourceConfig,
        destinationConfig: cloningJob.destinationConfig,
        transformationConfig: cloningJob.transformationConfig,
        validationConfig: cloningJob.validationConfig
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

    try {
      console.log('[AI Full] Opening modal and starting analysis...')
      setIsAnalyzingAI(true)
      setAiAnalysisError(null)
      setShowAIModal(true)
      console.log('[AI Full] Modal state set to open, isAnalyzing: true')

      const response = await fetch('/api/ai/config/full', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

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

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 1: // Select Source
        if (!formData.name.trim()) return false

        // For file-based jobs, require file upload OR storage file selection in create mode
        if (formData.type === 'file-based' && mode === 'create') {
          const hasManualUpload = fileSourceMode === 'upload' && formData._uploadedFile
          const hasStorageFile = fileSourceMode === 'storage' && selectedStorageFile
          if (!hasManualUpload && !hasStorageFile) {
            return false
          }
        }

        // For database jobs, require connection, table selection, AND schema detection
        if (formData.type === 'database') {
          if (!selectedConnectionId) return false
          if (!formData.sourceConfig.databaseConfig?.tableName) return false
          if (!formData._detectedSchema || formData._detectedSchema.length === 0) return false
        }
        return true
      case 2: // Load Strategy - always valid (has defaults)
        return true
      case 3: // Bronze Layer
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) return false
        return true
      case 4: // Silver Layer
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) return false
        }
        return true
      case 5: // Gold Layer
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) return false
        }
        return true
      case 6: // Review & Create
        return true
      default:
        return true
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1: // Select Source
        if (!formData.name.trim()) newErrors.name = 'Job name is required'

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
      case 3: // Bronze Layer
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) {
          newErrors.bronzeTable = 'Bronze table name is required'
        }
        break
      case 4: // Silver Layer
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) {
            newErrors.silverTable = 'Silver table name is required'
          }
        }
        break
      case 5: // Gold Layer
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) {
            newErrors.goldTable = 'Gold table name is required'
          }
        }
        break
      case 6: // Review & Create - validation happens in handleSubmit
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 6))

      // NOTE: AI Data Architect is now manually triggered via button in Step 2
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
                    Default order is assigned automatically. Adjust only if you need this job to run before/after others.
                  </p>
                </div>
              </details>
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
                                        <th className="text-left p-2 font-semibold text-foreground-muted">#</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Column Name</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Data Type</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Sample Value</th>
                                        <th className="text-left p-2 font-semibold text-foreground-muted">Nullable</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {formData._detectedSchema.map((col: any, index: number) => (
                                        <tr key={index} className="border-b border-border hover:bg-background-secondary transition-colors">
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
                                      ))}
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
                        _detectedMetadata: metadata, // Store metadata for Step 2 Load Strategy
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
                  )}
                    {errors.file && <FormError>{errors.file}</FormError>}
                  </FormField>
                  </>
                )}

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
                            {formData._detectedSchema.filter(c => ['email', 'phone', 'date', 'url', 'timestamp'].includes(c.type)).length}
                          </div>
                          <div className="text-xs text-purple-600 font-medium">Special Types</div>
                        </div>
                      </div>

                      {/* Metadata Detection Display */}
                      {formData._detectedMetadata && (
                        <div className="mt-4 space-y-3">
                          {/* Temporal Columns */}
                          {formData._detectedMetadata.temporal_columns && formData._detectedMetadata.temporal_columns.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-semibold text-green-900">
                                  Temporal Columns Detected ({formData._detectedMetadata.temporal_columns.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {formData._detectedMetadata.temporal_columns.map((col: string, idx: number) => (
                                  <Badge key={idx} variant="success" className="text-xs font-mono">
                                    {col}
                                  </Badge>
                                ))}
                              </div>
                              <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Can be used for incremental loading in the Load Strategy step
                              </p>
                            </div>
                          )}

                          {/* Primary Key Candidates */}
                          {formData._detectedMetadata.pk_candidates && formData._detectedMetadata.pk_candidates.length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Key className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-semibold text-blue-900">
                                  Primary Key Candidates ({formData._detectedMetadata.pk_candidates.length})
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {formData._detectedMetadata.pk_candidates.map((col: string, idx: number) => (
                                  <Badge key={idx} variant="default" className="text-xs font-mono bg-blue-100 text-blue-800 border-blue-300">
                                    {col}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Data Type Intelligence */}
                          {formData._detectedSchema.filter(c => ['email', 'phone', 'url'].includes(c.type)).length > 0 && (
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                              <div className="flex items-center gap-2 mb-2">
                                <Sparkles className="w-4 h-4 text-purple-600" />
                                <span className="text-xs font-semibold text-purple-900">
                                  Intelligent Data Types Detected
                                </span>
                              </div>
                              <div className="space-y-1">
                                {formData._detectedSchema.filter(c => c.type === 'email').length > 0 && (
                                  <div className="text-xs text-purple-700 flex items-center gap-2">
                                    <Mail className="w-3 h-3" />
                                    <span>{formData._detectedSchema.filter(c => c.type === 'email').length} Email column(s)</span>
                                  </div>
                                )}
                                {formData._detectedSchema.filter(c => c.type === 'phone').length > 0 && (
                                  <div className="text-xs text-purple-700 flex items-center gap-2">
                                    <Phone className="w-3 h-3" />
                                    <span>{formData._detectedSchema.filter(c => c.type === 'phone').length} Phone column(s)</span>
                                  </div>
                                )}
                                {formData._detectedSchema.filter(c => c.type === 'url').length > 0 && (
                                  <div className="text-xs text-purple-700 flex items-center gap-2">
                                    <Globe className="w-3 h-3" />
                                    <span>{formData._detectedSchema.filter(c => c.type === 'url').length} URL column(s)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="text-xs text-blue-700 mt-3 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Schema detected. Configure Load Strategy in the next step to set up extraction mode.
                      </p>
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
                      onConnectionChange={(connection) => {
                        updateSourceConfig({ connection })
                      }}
                      onDatabaseConfigChange={(databaseConfig) => {
                        updateSourceConfig({ databaseConfig })
                      }}
                      onSchemaDetected={(schema, tableName, metadata) => {
                        console.log('[Step1] onSchemaDetected called with schema:', schema?.length, 'columns, tableName:', tableName)
                        console.log('[Step1] Metadata:', metadata)

                        // Store detected schema and preview
                        setFormData(prev => ({
                          ...prev,
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
                              pk_candidates: metadata?.pk_candidates || []
                            }
                          }))

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

            {/* AI Data Architect Card */}
            <Card className={cn(
              "border-2 transition-all",
              fullAiAnalysis?.success
                ? "border-green-300 bg-green-50/30"
                : "border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50"
            )}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
                    fullAiAnalysis?.success ? "bg-green-100" : "bg-purple-100"
                  )}>
                    <Sparkles className={cn(
                      "w-6 h-6",
                      fullAiAnalysis?.success ? "text-green-600" : "text-purple-600"
                    )} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-foreground">AI Data Architect</h3>
                      {fullAiAnalysis?.success && (
                        <Badge variant="success" className="text-xs">Analysis Complete</Badge>
                      )}
                      {isAnalyzingAI && (
                        <Badge variant="secondary" className="text-xs animate-pulse">Analyzing...</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground-muted mb-3">
                      {fullAiAnalysis?.success
                        ? `AI has analyzed your data and provided recommendations for all layers. Provider: ${fullAiAnalysis.providerUsed || 'AI'}`
                        : "Let AI analyze your data and recommend optimal configurations for Load Strategy, Bronze, Silver, and Gold layers."
                      }
                    </p>
                    <div className="flex items-center gap-3">
                      {!fullAiAnalysis?.success ? (
                        <Button
                          onClick={() => {
                            console.log('[AI Data Architect] Manual trigger clicked')
                            fetchFullAIAnalysis()
                          }}
                          disabled={isAnalyzingAI}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {isAnalyzingAI ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Run AI Data Architect
                            </>
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            onClick={() => setShowAIModal(true)}
                            className="border-green-300 text-green-700 hover:bg-green-50"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Recommendations
                          </Button>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              console.log('[AI Data Architect] Re-run clicked')
                              fetchFullAIAnalysis()
                            }}
                            disabled={isAnalyzingAI}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          >
                            <RefreshCw className={cn("w-4 h-4 mr-2", isAnalyzingAI && "animate-spin")} />
                            Re-analyze
                          </Button>
                        </>
                      )}
                      <span className="text-xs text-foreground-muted">
                        or configure manually below
                      </span>
                    </div>
                    {aiAnalysisError && (
                      <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {aiAnalysisError}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

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

                {/* CDC Option - Coming Soon */}
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

      case 3: // Bronze Layer (was case 2)
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

            {/* AI Suggestions Card - Show for both database and file sources */}
            {(() => {
              // Check if we have analyzable data from any source type
              const isDatabaseSource = formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName
              const isFileSource = formData.type === 'file-based' && formData._detectedSchema && formData._detectedSchema.length > 0 && formData._previewData && formData._previewData.length > 0

              if (!isDatabaseSource && !isFileSource) {
                return null
              }

              // Show as static display if AI recommendations have been applied
              const aiApplied = formData._aiUsageMetadata?.bronze?.applied === true

              // Use fullAiAnalysis.bronze data when AI has been applied
              const bronzeSuggestions: Record<string, AISuggestion> = aiApplied && fullAiAnalysis?.bronze
                ? {
                    ...(fullAiAnalysis.bronze.incremental_load && {
                      incremental_load: {
                        enabled: fullAiAnalysis.bronze.incremental_load.enabled,
                        confidence: 85,
                        reasoning: fullAiAnalysis.bronze.incremental_load.reasoning || 'AI analyzed your data patterns',
                        strategy: fullAiAnalysis.bronze.incremental_load.strategy,
                        watermark_column: fullAiAnalysis.bronze.incremental_load.watermark_column
                      }
                    }),
                    ...(fullAiAnalysis.bronze.schema_evolution && {
                      schema_evolution: {
                        enabled: fullAiAnalysis.bronze.schema_evolution.enabled,
                        confidence: 80,
                        reasoning: fullAiAnalysis.bronze.schema_evolution.reasoning || 'Recommended for evolving data sources',
                        mode: fullAiAnalysis.bronze.schema_evolution.mode
                      }
                    }),
                    ...(fullAiAnalysis.bronze.partitioning && {
                      partitioning: {
                        enabled: fullAiAnalysis.bronze.partitioning.enabled,
                        confidence: 75,
                        reasoning: fullAiAnalysis.bronze.partitioning.reasoning || 'Optimizes query performance',
                        columns: fullAiAnalysis.bronze.partitioning.columns
                      }
                    })
                  }
                : (aiSuggestions || {})

              const hasSuggestions = Object.keys(bronzeSuggestions).length > 0
              console.log('[Step2] Rendering AI card - isDatabaseSource:', isDatabaseSource, 'isFileSource:', isFileSource, 'hasSuggestions:', hasSuggestions, 'loading:', isLoadingAiSuggestions, 'aiApplied:', aiApplied)

              // Get source name for description
              const sourceName = isDatabaseSource
                ? formData.sourceConfig.databaseConfig?.tableName
                : formData._uploadedFile?.name || formData.name

              // Get confidence from metadata
              const confidence = formData._aiUsageMetadata?.bronze?.confidence
                ? Math.round(formData._aiUsageMetadata.bronze.confidence * 100)
                : undefined

              return (
                <AISuggestionCard
                  title="AI Data Architect Suggestions"
                  description={`Based on analyzing ${sourceName}`}
                  suggestions={bronzeSuggestions}
                  loading={isLoadingAiSuggestions}
                  error={aiSuggestionsError}
                  onAccept={hasSuggestions && !aiApplied ? applyAiSuggestions : undefined}
                  onAdjust={hasSuggestions && !aiApplied ? () => {
                    console.log('[AI] Toggle expanded from', aiSuggestionsExpanded, 'to', !aiSuggestionsExpanded)
                    setAiSuggestionsExpanded(!aiSuggestionsExpanded)
                  } : undefined}
                  isExpanded={hasSuggestions && aiSuggestionsExpanded}
                  onToggleExpand={hasSuggestions && !aiApplied ? () => {
                    console.log('[AI] onToggleExpand from', aiSuggestionsExpanded, 'to', !aiSuggestionsExpanded)
                    setAiSuggestionsExpanded(!aiSuggestionsExpanded)
                  } : undefined}
                  usingFallback={usingFallbackBronze}
                  staticDisplay={aiApplied}
                  confidenceOverride={confidence}
                />
              )
            })()}

            {/* Bronze Layer - Enhanced */}
            <Card className="border-amber-300 bg-amber-50/30">
              <CardHeader className="pb-3 bg-amber-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Bronze Layer (Raw Data Ingestion)
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={resetToManualDefaults}
                      className="text-xs h-7 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      Reset to Defaults
                    </Button>
                    <Badge variant="success" className="text-xs">Active</Badge>
                  </div>
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
                              <code className="font-mono bg-white px-1 py-0.5 rounded">_ingestion_id</code> - Unique ingestion job identifier
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
                      For comprehensive validation rules, configure them in the Data Quality tab after job creation.
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
                      For comprehensive data quality rules (null handling, type validation, deduplication), configure them in the <strong>Data Quality</strong> tab after job creation.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )

      case 4: // Silver Layer (was case 3)
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

            {/* Silver AI Suggestions Card - Show for both database and file sources */}
            {(() => {
              // Check if we have analyzable data from any source type
              const isDatabaseSource = formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName
              const isFileSource = formData.type === 'file-based' && formData._detectedSchema && formData._detectedSchema.length > 0 && formData._previewData && formData._previewData.length > 0

              if (!isDatabaseSource && !isFileSource) {
                return null
              }

              // Show as static display if AI recommendations have been applied
              const aiApplied = formData._aiUsageMetadata?.silver?.applied === true

              // Use fullAiAnalysis.silver data when AI has been applied
              const silverSuggestions: Record<string, AISuggestion> = aiApplied && fullAiAnalysis?.silver
                ? {
                    ...(fullAiAnalysis.silver.primary_key && {
                      primary_key: {
                        enabled: true,
                        confidence: 90,
                        reasoning: fullAiAnalysis.silver.primary_key.reasoning || 'Identified unique key columns',
                        columns: fullAiAnalysis.silver.primary_key.columns?.join(', ')
                      }
                    }),
                    ...(fullAiAnalysis.silver.deduplication && {
                      deduplication: {
                        enabled: fullAiAnalysis.silver.deduplication.enabled,
                        confidence: 85,
                        reasoning: fullAiAnalysis.silver.deduplication.reasoning || 'Remove duplicate records',
                        strategy: fullAiAnalysis.silver.deduplication.strategy
                      }
                    }),
                    ...(fullAiAnalysis.silver.merge_strategy && {
                      merge_strategy: {
                        enabled: true,
                        confidence: 80,
                        reasoning: fullAiAnalysis.silver.merge_strategy.reasoning || 'Optimal merge approach',
                        type: fullAiAnalysis.silver.merge_strategy.type
                      }
                    })
                  }
                : (silverAiSuggestions || {})

              const hasSilverSuggestions = Object.keys(silverSuggestions).length > 0
              console.log('[Step3] Rendering Silver AI card - isDatabaseSource:', isDatabaseSource, 'isFileSource:', isFileSource, 'hasSilverSuggestions:', hasSilverSuggestions, 'loading:', isLoadingSilverAiSuggestions, 'aiApplied:', aiApplied)

              // Get source name for description
              const sourceName = isDatabaseSource
                ? formData.sourceConfig.databaseConfig?.tableName
                : formData._uploadedFile?.name || formData.name

              // Get confidence from metadata
              const confidence = formData._aiUsageMetadata?.silver?.confidence
                ? Math.round(formData._aiUsageMetadata.silver.confidence * 100)
                : undefined

              return (
                <AISuggestionCard
                  title="AI Data Quality Architect Suggestions"
                  description={`Based on analyzing ${sourceName}`}
                  suggestions={silverSuggestions}
                  loading={isLoadingSilverAiSuggestions}
                  error={silverAiSuggestionsError}
                  onAccept={hasSilverSuggestions && !aiApplied ? applySilverAiSuggestions : undefined}
                  onAdjust={hasSilverSuggestions && !aiApplied ? () => {
                    console.log('[Silver AI] Toggle expanded from', silverAiSuggestionsExpanded, 'to', !silverAiSuggestionsExpanded)
                    setSilverAiSuggestionsExpanded(!silverAiSuggestionsExpanded)
                  } : undefined}
                  isExpanded={hasSilverSuggestions && silverAiSuggestionsExpanded}
                  onToggleExpand={hasSilverSuggestions && !aiApplied ? () => {
                    console.log('[Silver AI] onToggleExpand from', silverAiSuggestionsExpanded, 'to', !silverAiSuggestionsExpanded)
                    setSilverAiSuggestionsExpanded(!silverAiSuggestionsExpanded)
                  } : undefined}
                  usingFallback={usingFallbackSilver}
                  staticDisplay={aiApplied}
                  confidenceOverride={confidence}
                />
              )
            })()}

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
                        <span>Quality rules will be available in the Quality Module after job creation</span>
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
                        <div>• <code className="font-mono bg-white px-1 py-0.5 rounded">_load_id</code> - Ingestion job identifier</div>
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
              </CardContent>
            </Card>
          </div>
        )

      case 5: // Gold Layer (was case 4)
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

            {/* Gold AI Suggestions Card - Show for both database and file sources */}
            {(() => {
              // Check if we have analyzable data from any source type
              const isDatabaseSource = formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName
              const isFileSource = formData.type === 'file-based' && formData._detectedSchema && formData._detectedSchema.length > 0 && formData._previewData && formData._previewData.length > 0

              if (!isDatabaseSource && !isFileSource) {
                return null
              }

              // Show as static display if AI recommendations have been applied
              const aiApplied = formData._aiUsageMetadata?.gold?.applied === true

              // Use fullAiAnalysis.gold data when AI has been applied
              // Backend returns: aggregation (not aggregations), dimensions, indexing, materialization, schedule
              const goldData = fullAiAnalysis?.gold as any
              const goldSuggestions: Record<string, AISuggestion> = aiApplied && goldData
                ? {
                    // Aggregation config (backend uses 'aggregation' not 'aggregations')
                    ...(goldData.aggregation && {
                      aggregation: {
                        enabled: goldData.aggregation.enabled !== false,
                        confidence: goldData.aggregation.confidence || 85,
                        reasoning: goldData.aggregation.reasoning || 'Recommended analytics aggregations',
                        level: goldData.aggregation.level,
                        metrics: goldData.aggregation.metrics?.map((m: any) => m.name || m).join(', ') || ''
                      }
                    }),
                    // Dimensions (top-level in backend response)
                    ...(goldData.dimensions && goldData.dimensions.length > 0 && {
                      dimensions: {
                        enabled: true,
                        confidence: 80,
                        reasoning: 'Key dimensions for analytics grouping',
                        columns: goldData.dimensions.join(', ')
                      }
                    }),
                    // Indexing strategy
                    ...(goldData.indexing && goldData.indexing.enabled && {
                      indexing: {
                        enabled: true,
                        confidence: goldData.indexing.confidence || 75,
                        reasoning: goldData.indexing.reasoning || 'Recommended indexing for query performance',
                        strategy: goldData.indexing.strategy,
                        columns: goldData.indexing.columns?.join(', ') || ''
                      }
                    }),
                    // Materialization strategy
                    ...(goldData.materialization && goldData.materialization.enabled && {
                      materialization: {
                        enabled: true,
                        confidence: goldData.materialization.confidence || 80,
                        reasoning: goldData.materialization.reasoning || 'Recommended materialization strategy',
                        refresh_strategy: goldData.materialization.refresh_strategy
                      }
                    }),
                    // Schedule config
                    ...(goldData.schedule && {
                      schedule: {
                        enabled: true,
                        confidence: goldData.schedule.confidence || 75,
                        reasoning: goldData.schedule.reasoning || goldData.schedule.recommended_time || 'Recommended refresh schedule',
                        frequency: goldData.schedule.frequency,
                        cron: goldData.schedule.cron_expression
                      }
                    })
                  }
                : (goldAiSuggestions || {})

              const hasGoldSuggestions = Object.keys(goldSuggestions).length > 0
              console.log('[Step4] Rendering Gold AI card - isDatabaseSource:', isDatabaseSource, 'isFileSource:', isFileSource, 'hasGoldSuggestions:', hasGoldSuggestions, 'loading:', isLoadingGoldAiSuggestions, 'aiApplied:', aiApplied)
              console.log('[Step4] Gold data from backend:', goldData)
              console.log('[Step4] Mapped goldSuggestions:', goldSuggestions)

              // Get source name for description
              const sourceName = isDatabaseSource
                ? formData.sourceConfig.databaseConfig?.tableName
                : formData._uploadedFile?.name || formData.name

              // Get confidence from metadata
              const confidence = formData._aiUsageMetadata?.gold?.confidence
                ? Math.round(formData._aiUsageMetadata.gold.confidence * 100)
                : undefined

              return (
                <div className="mb-4 space-y-3">
                  {/* Business Context Input - only show if AI not yet applied */}
                  {!aiApplied && (
                    <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-900">Business Context (Optional)</span>
                      </div>
                      <p className="text-xs text-amber-700 mb-3">
                        Provide business context to help AI suggest better metrics and aggregations (e.g., "Customer transaction analytics for monthly revenue reporting")
                      </p>
                      <textarea
                        value={businessContext}
                        onChange={(e) => setBusinessContext(e.target.value)}
                        placeholder="Describe the business use case for this Gold layer..."
                        className="w-full text-xs p-2 border border-amber-300 rounded-md focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        rows={2}
                      />
                      {businessContext && businessContext.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setBusinessContext('')
                            fetchGoldAiSuggestions()
                          }}
                          className="mt-2 text-xs text-amber-700 hover:text-amber-900 underline"
                        >
                          Clear & Refresh AI Suggestions
                        </button>
                      )}
                    </div>
                  )}

                  {/* AI Suggestions Card */}
                  <AISuggestionCard
                    title="AI Analytics Architect Suggestions"
                    description={`Based on analyzing ${sourceName}${businessContext ? ' with business context' : ''}`}
                    suggestions={goldSuggestions}
                    loading={isLoadingGoldAiSuggestions}
                    error={goldAiSuggestionsError}
                    onAccept={hasGoldSuggestions && !aiApplied ? applyGoldAiSuggestions : undefined}
                    onAdjust={hasGoldSuggestions && !aiApplied ? () => {
                      console.log('[Gold AI] Toggle expanded from', goldAiSuggestionsExpanded, 'to', !goldAiSuggestionsExpanded)
                      setGoldAiSuggestionsExpanded(!goldAiSuggestionsExpanded)
                    } : undefined}
                    isExpanded={hasGoldSuggestions && goldAiSuggestionsExpanded}
                    onToggleExpand={hasGoldSuggestions && !aiApplied ? () => {
                      console.log('[Gold AI] onToggleExpand from', goldAiSuggestionsExpanded, 'to', !goldAiSuggestionsExpanded)
                      setGoldAiSuggestionsExpanded(!goldAiSuggestionsExpanded)
                    } : undefined}
                    usingFallback={usingFallbackGold}
                    staticDisplay={aiApplied}
                    confidenceOverride={confidence}
                  />
                </div>
              )
            })()}

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

      case 6: // Review & Create (was case 5)
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
                      {mode === 'edit' ? ' Click "Save Changes" to update this job.' : ' Click "Create Job" to add this job to your workflow.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )

      case 6: // Review & Create - Alternate version (was case 5)
        return (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-purple-200 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-purple-600" />
                <div>
                  <h4 className="text-lg font-semibold text-purple-900 mb-1">Review & Submit</h4>
                  <p className="text-sm text-purple-800">
                    Review your configuration and AI assistance levels before creating the job
                  </p>
                </div>
              </div>
            </div>

            {/* Source Configuration Summary */}
            <Card className="border-blue-200 bg-blue-50/30">
              <CardHeader className="pb-3 bg-blue-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Database className="w-4 h-4 text-blue-600" />
                    Source Configuration
                  </CardTitle>
                  <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                    Manual ⚙
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{formData.type === 'database' ? 'Database' : 'File-based'}</span>
                </div>
                {formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database Type:</span>
                      <span className="font-medium">{formData.sourceConfig.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Table:</span>
                      <span className="font-medium">{formData.sourceConfig.databaseConfig.tableName}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Bronze Layer Summary */}
            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader className="pb-3 bg-amber-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                    Bronze Layer (Raw)
                  </CardTitle>
                  {formData._aiUsageMetadata?.bronze?.applied ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      ✓ AI Applied
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      Manual ⚙
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Storage Format:</span>
                  <span className="font-medium">{formData.destinationConfig.bronzeConfig?.storageFormat || 'parquet'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Load Strategy:</span>
                  <span className="font-medium">{formData.destinationConfig.bronzeConfig?.loadStrategy || 'append'}</span>
                </div>
                {formData._aiUsageMetadata?.bronze?.applied && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Suggestions Applied:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.bronze.appliedCount} of {formData._aiUsageMetadata.bronze.suggestionsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Confidence:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.bronze.confidence}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Silver Layer Summary */}
            <Card className="border-gray-300 bg-gray-50/30">
              <CardHeader className="pb-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                    Silver Layer (Validated)
                  </CardTitle>
                  {formData._aiUsageMetadata?.silver?.applied ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      ✓ AI Applied
                    </Badge>
                  ) : silverAiSuggestions && Object.keys(silverAiSuggestions).length > 0 ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      ℹ AI Suggested
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      Manual ⚙
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primary Key:</span>
                  <span className="font-medium">{formData.destinationConfig.silverConfig?.primaryKey || 'Not configured'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Merge Strategy:</span>
                  <span className="font-medium">{formData.destinationConfig.silverConfig?.mergeStrategy || 'merge'}</span>
                </div>
                {formData._aiUsageMetadata?.silver?.applied && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Suggestions Applied:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.silver.appliedCount} of {formData._aiUsageMetadata.silver.suggestionsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Confidence:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.silver.confidence}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Gold Layer Summary */}
            <Card className="border-yellow-300 bg-yellow-50/30">
              <CardHeader className="pb-3 bg-yellow-50">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    Gold Layer (Business-Ready)
                  </CardTitle>
                  {formData._aiUsageMetadata?.gold?.applied ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      ✓ AI Applied
                    </Badge>
                  ) : goldAiSuggestions && Object.keys(goldAiSuggestions).length > 0 ? (
                    <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                      ℹ AI Suggested
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
                      Manual ⚙
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aggregation:</span>
                  <span className="font-medium">{formData.destinationConfig.goldConfig?.aggregationEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Materialization:</span>
                  <span className="font-medium">{formData.destinationConfig.goldConfig?.materializationType || 'view'}</span>
                </div>
                {formData._aiUsageMetadata?.gold?.applied && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Suggestions Applied:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.gold.appliedCount} of {formData._aiUsageMetadata.gold.suggestionsCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">AI Confidence:</span>
                      <span className="font-medium">{formData._aiUsageMetadata.gold.confidence}%</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Overall Summary */}
            {formData._detectedSchema && formData._detectedSchema.length > 0 && (
              <Card className="border-green-200 bg-green-50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    Configuration Complete
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Your job is configured and ready to process <strong>{formData._detectedSchema.length} columns</strong> through the medallion architecture.
                    {mode === 'edit' ? ' Click "Save Changes" to update this job.' : ' Click "Create Job" to add this job to your workflow.'}
                  </p>
                </CardContent>
              </Card>
            )}
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
            {mode === 'edit' ? 'Edit Job' : cloningJob ? 'Clone Job' : 'Create New Job'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'edit'
              ? 'Update job configuration and settings'
              : cloningJob
                ? 'Create a new job based on existing configuration'
                : 'Configure a new data processing job for your workflow'}
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
              {currentStep < 6 ? (
                <Button onClick={nextStep} disabled={!isStepValid(currentStep)}>
                  Next
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={!isStepValid(currentStep)}>
                  {mode === 'edit' ? 'Save Changes' : 'Create Job'}
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
