'use client'

import * as React from 'react'
import { Button, Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Select, Textarea } from '@/components/ui/form'
import { Input } from '@/components/ui'
import { Job, JobType, DataSourceType, DataSourceConfig, DestinationConfig, TransformationConfig, ValidationConfig } from '@/types/workflow'
import { FileText, Database, Cloud, ArrowRight, ArrowLeft, CheckCircle, Upload, Settings, Shield, AlertCircle, Eye, HardDrive, Sparkles, Activity, Clock, Key, Mail, Phone, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CSVFileUpload } from './csv-file-upload'
import { DatabaseSourceConfig } from './database-source-config'
import { CreateConnectionModal } from '@/components/database'
import { DatabaseConnection } from '@/types/database-connection'
import { AISuggestionCard, AISuggestion } from '@/components/ai/ai-suggestion-card'
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

  // AI Suggestions state - Bronze Layer
  const [aiSuggestions, setAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingAiSuggestions, setIsLoadingAiSuggestions] = React.useState(false)
  const [aiSuggestionsError, setAiSuggestionsError] = React.useState<string | null>(null)
  const [aiSuggestionsExpanded, setAiSuggestionsExpanded] = React.useState(false)
  const [usingFallbackBronze, setUsingFallbackBronze] = React.useState(false)

  // AI Suggestions state - Silver Layer
  const [silverAiSuggestions, setSilverAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingSilverAiSuggestions, setIsLoadingSilverAiSuggestions] = React.useState(false)
  const [silverAiSuggestionsError, setSilverAiSuggestionsError] = React.useState<string | null>(null)
  const [silverAiSuggestionsExpanded, setSilverAiSuggestionsExpanded] = React.useState(false)
  const [usingFallbackSilver, setUsingFallbackSilver] = React.useState(false)

  // AI Suggestions state - Gold Layer
  const [goldAiSuggestions, setGoldAiSuggestions] = React.useState<Record<string, AISuggestion> | null>(null)
  const [isLoadingGoldAiSuggestions, setIsLoadingGoldAiSuggestions] = React.useState(false)
  const [goldAiSuggestionsError, setGoldAiSuggestionsError] = React.useState<string | null>(null)
  const [goldAiSuggestionsExpanded, setGoldAiSuggestionsExpanded] = React.useState(false)
  const [businessContext, setBusinessContext] = React.useState<string>('')
  const [usingFallbackGold, setUsingFallbackGold] = React.useState(false)

  const resetForm = React.useCallback(() => {
    setFormData(initialFormData)
    setCurrentStep(1)
    setErrors({})
    csvUploadRef.current?.reset()
  }, [])

  // Populate form data when editing or cloning
  React.useEffect(() => {
    if (mode === 'edit' && editingJob && open) {
      setFormData({
        name: editingJob.name,
        description: editingJob.description,
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
        description: cloningJob.description,
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

  // Fetch AI suggestions for Bronze layer configuration
  const fetchAiSuggestions = React.useCallback(async (tableName?: string, connectionId?: string, dbType?: string) => {
    console.log('[AI] ===== fetchAiSuggestions CALLED =====')

    // Use provided parameters or fall back to formData
    const useTableName = tableName || formData.sourceConfig.databaseConfig?.tableName
    const useConnectionId = connectionId || selectedConnectionId
    const useDbType = dbType || formData.sourceConfig.type

    console.log('[AI] Parameters:', {
      providedTableName: tableName,
      providedConnectionId: connectionId,
      providedDbType: dbType,
      finalTableName: useTableName,
      finalConnectionId: useConnectionId,
      finalDbType: useDbType
    })

    if (!useConnectionId || !useTableName || !useDbType) {
      console.log('[AI] Skipping AI suggestions - missing required data:', {
        hasConnectionId: !!useConnectionId,
        hasTableName: !!useTableName,
        hasType: !!useDbType
      })
      return
    }

    console.log('[AI] Fetching AI suggestions with:', {
      dbType: useDbType,
      connectionId: useConnectionId,
      tableName: useTableName
    })

    setIsLoadingAiSuggestions(true)
    setAiSuggestionsError(null)

    try {
      const response = await fetch('/api/ai/config/bronze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType: useDbType,
          connectionId: useConnectionId,
          tableName: useTableName
        })
      })

      console.log('[AI] Response status:', response.status)
      const result = await response.json()
      console.log('[AI] Response data:', result)

      if (result.success && result.suggestions) {
        console.log('[AI] Suggestions received:', Object.keys(result.suggestions))
        // Extract fallback indicator before setting suggestions
        const usingFallback = result.suggestions._using_fallback || false
        setUsingFallbackBronze(usingFallback)
        setAiSuggestions(result.suggestions)
        setAiSuggestionsError(null)

        // Track telemetry
        const suggestionsCount = Object.keys(result.suggestions).filter(k => !k.startsWith('_')).length
        const confidenceScores = Object.values(result.suggestions)
          .filter((s: any) => s?.confidence)
          .map((s: any) => s.confidence)
        const overallConfidence = confidenceScores.length > 0
          ? Math.round(confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length)
          : 0

        trackAISuggestionsFetched({
          layer: 'bronze',
          tableName: useTableName || '',
          suggestionsCount,
          overallConfidence,
          usingFallback
        })
      } else {
        console.error('[AI] Failed to get suggestions:', result.message)

        // Check if it's an API credit issue
        let errorMessage = result.message || 'Failed to generate AI suggestions'
        if (result.error && (
          result.error.includes('credit balance is too low') ||
          result.error.includes('insufficient credits') ||
          result.error.includes('BadRequestError')
        )) {
          errorMessage = 'AI service is temporarily unavailable due to API credits. Please contact your administrator or add credits to your Anthropic account.'
        }

        setAiSuggestionsError(errorMessage)

        // Track error telemetry
        trackAIError({
          layer: 'bronze',
          errorMessage,
          fallbackUsed: false
        })
      }
    } catch (error) {
      console.error('[AI] Error fetching AI suggestions:', error)
      const errorMsg = 'Failed to generate AI suggestions. Please try again.'
      setAiSuggestionsError(errorMsg)

      // Track error telemetry
      trackAIError({
        layer: 'bronze',
        errorMessage: errorMsg,
        fallbackUsed: false
      })
    } finally {
      setIsLoadingAiSuggestions(false)
    }
  }, [selectedConnectionId, formData.sourceConfig.databaseConfig?.tableName, formData.sourceConfig.type])

  // Fetch AI suggestions for Silver layer configuration
  const fetchSilverAiSuggestions = React.useCallback(async () => {
    console.log('[Silver AI] ===== fetchSilverAiSuggestions CALLED =====')

    const useTableName = formData.sourceConfig.databaseConfig?.tableName
    const useConnectionId = selectedConnectionId
    const useDbType = formData.sourceConfig.type

    if (!useTableName || !useConnectionId || !useDbType) {
      console.log('[Silver AI] Missing required data:', { useTableName, useConnectionId, useDbType })
      return
    }

    console.log('[Silver AI] Fetching suggestions for:', { useTableName, useConnectionId, useDbType })

    setIsLoadingSilverAiSuggestions(true)
    setSilverAiSuggestionsError(null)

    try {
      const response = await fetch('/api/ai/config/silver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType: useDbType,
          connectionId: useConnectionId,
          tableName: useTableName,
          bronzeMetadata: formData._detectedMetadata || null
        })
      })

      const result = await response.json()
      console.log('[Silver AI] API response:', result)

      if (result.success && result.suggestions) {
        console.log('[Silver AI] Setting suggestions:', result.suggestions)
        // Extract fallback indicator before setting suggestions
        const usingFallback = result.suggestions._using_fallback || false
        setUsingFallbackSilver(usingFallback)
        setSilverAiSuggestions(result.suggestions)
        setSilverAiSuggestionsError(null)
      } else {
        console.error('[Silver AI] API returned error:', result.message)
        let errorMessage = result.message || 'Failed to generate Silver layer suggestions'

        // Provide user-friendly error messages for common issues
        if (result.error && (
          result.error.includes('credit balance is too low') ||
          result.error.includes('insufficient credits') ||
          result.error.includes('BadRequestError')
        )) {
          errorMessage = 'AI service is temporarily unavailable due to API credits. Please contact your administrator or add credits to your Anthropic account.'
        }

        setSilverAiSuggestionsError(errorMessage)
      }
    } catch (error) {
      console.error('[Silver AI] Error fetching AI suggestions:', error)
      setSilverAiSuggestionsError('Failed to generate Silver AI suggestions. Please try again.')
    } finally {
      setIsLoadingSilverAiSuggestions(false)
    }
  }, [selectedConnectionId, formData.sourceConfig.databaseConfig?.tableName, formData.sourceConfig.type, formData._detectedMetadata])

  // Fetch Gold AI Suggestions
  const fetchGoldAiSuggestions = React.useCallback(async () => {
    console.log('[Gold AI] ===== fetchGoldAiSuggestions CALLED =====')

    const useTableName = formData.sourceConfig.databaseConfig?.tableName
    const useConnectionId = selectedConnectionId
    const useDbType = formData.sourceConfig.type

    if (!useTableName || !useConnectionId || !useDbType) {
      console.log('[Gold AI] Missing required data:', { useTableName, useConnectionId, useDbType })
      return
    }

    console.log('[Gold AI] Fetching suggestions for:', { useTableName, useConnectionId, useDbType, businessContext: businessContext || 'not provided' })

    setIsLoadingGoldAiSuggestions(true)
    setGoldAiSuggestionsError(null)

    try {
      const response = await fetch('/api/ai/config/gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType: useDbType,
          connectionId: useConnectionId,
          tableName: useTableName,
          businessContext: businessContext || null
        })
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
  }, [selectedConnectionId, formData.sourceConfig.databaseConfig?.tableName, formData.sourceConfig.type, businessContext])

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
      case 1:
        if (!formData.name.trim()) return false

        // For file-based jobs, require file upload in create mode
        if (formData.type === 'file-based' && mode === 'create' && !formData._uploadedFile) {
          return false
        }

        // For database jobs, require connection, table selection, AND schema detection
        if (formData.type === 'database') {
          if (!selectedConnectionId) return false
          if (!formData.sourceConfig.databaseConfig?.tableName) return false
          if (!formData._detectedSchema || formData._detectedSchema.length === 0) return false
        }
        return true
      case 2:
        if (!formData.destinationConfig.bronzeConfig?.tableName?.trim()) return false
        return true
      case 3:
        if (formData.destinationConfig.silverConfig?.enabled !== false) {
          if (!formData.destinationConfig.silverConfig?.tableName?.trim()) return false
        }
        return true
      case 4:
        if (formData.destinationConfig.goldConfig?.enabled !== false) {
          if (!formData.destinationConfig.goldConfig?.tableName?.trim()) return false
        }
        return true
      default:
        return true
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (step) {
      case 1:
        if (!formData.name.trim()) newErrors.name = 'Job name is required'

        // For file-based jobs, require file upload in create mode
        if (formData.type === 'file-based' && mode === 'create' && !formData._uploadedFile) {
          newErrors.file = 'File upload is required'
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
      const nextStepNumber = currentStep + 1
      setCurrentStep(prev => Math.min(prev + 1, 5))

      // Trigger Silver AI suggestions when moving to Step 3
      if (nextStepNumber === 3 && formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName) {
        console.log('[Step Navigation] Moving to Step 3 - triggering Silver AI suggestions')
        setTimeout(() => {
          fetchSilverAiSuggestions()
        }, 500)
      }

      // Trigger Gold AI suggestions when moving to Step 4
      if (nextStepNumber === 4 && formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName) {
        console.log('[Step Navigation] Moving to Step 4 - triggering Gold AI suggestions')
        setTimeout(() => {
          fetchGoldAiSuggestions()
        }, 500)
      }

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

                      // Check if we have temporal columns for auto-configuration
                      const hasTemporalColumn = metadata?.temporal_columns && metadata.temporal_columns.length > 0

                      console.log('[CSV Upload] Has temporal columns:', hasTemporalColumn, metadata?.temporal_columns)

                      setFormData(prev => ({
                        ...prev,
                        name: prev.name || file.name.replace(/\.[^/.]+$/, ""),
                        _uploadedFile: file,
                        _detectedSchema: schema,
                        _previewData: preview,
                        _detectedMetadata: metadata, // Store metadata for UI display
                        transformationConfig: transformationConfig,
                        // Update source config with hasHeader flag
                        sourceConfig: {
                          ...prev.sourceConfig,
                          fileConfig: {
                            ...prev.sourceConfig.fileConfig!,
                            filePath: file.name,
                            filePattern: file.name,
                            hasHeader: !columnMappings || columnMappings.length === 0,
                            // Auto-configure incremental loading if temporal column detected
                            isIncremental: hasTemporalColumn,
                            deltaColumn: hasTemporalColumn ? metadata!.temporal_columns![0] : undefined,
                            lastWatermark: hasTemporalColumn ? '' : undefined
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
                              {formData.sourceConfig.fileConfig?.isIncremental && (
                                <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                                  <CheckCircle className="w-3 h-3" />
                                  Auto-configured for incremental loading using: <code className="font-mono bg-green-100 px-1 rounded">{formData.sourceConfig.fileConfig.deltaColumn}</code>
                                </p>
                              )}
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
                        Table names have been auto-generated based on your file. You can customize them in the next step.
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

                          // Auto-configure incremental settings
                          if (hasTemporalColumn) {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig,
                                tableName,
                                isIncremental: true,
                                deltaColumn: metadata!.temporal_columns![0], // Use first temporal column
                                lastWatermark: ''
                              }
                            })
                          } else {
                            updateSourceConfig({
                              databaseConfig: {
                                ...formData.sourceConfig.databaseConfig,
                                tableName,
                                isIncremental: false
                              }
                            })
                          }

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

            {/* AI Suggestions Card - Only show for database jobs */}
            {formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName && (() => {
              const hasSuggestions = !!(aiSuggestions && Object.keys(aiSuggestions).length > 0)
              console.log('[Step2] Rendering AI card - hasSuggestions:', hasSuggestions, 'loading:', isLoadingAiSuggestions, 'suggestions:', aiSuggestions)

              return (
                <AISuggestionCard
                  title="AI Data Architect Suggestions"
                  description={`Based on analyzing ${formData.sourceConfig.databaseConfig.tableName}`}
                  suggestions={aiSuggestions || {}}
                  loading={isLoadingAiSuggestions}
                  error={aiSuggestionsError}
                  onAccept={hasSuggestions ? applyAiSuggestions : undefined}
                  onAdjust={hasSuggestions ? () => {
                    console.log('[AI] Toggle expanded from', aiSuggestionsExpanded, 'to', !aiSuggestionsExpanded)
                    setAiSuggestionsExpanded(!aiSuggestionsExpanded)
                  } : undefined}
                  isExpanded={hasSuggestions && aiSuggestionsExpanded}
                  onToggleExpand={hasSuggestions ? () => {
                    console.log('[AI] onToggleExpand from', aiSuggestionsExpanded, 'to', !aiSuggestionsExpanded)
                    setAiSuggestionsExpanded(!aiSuggestionsExpanded)
                  } : undefined}
                  usingFallback={usingFallbackBronze}
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
                  </div>
                ) : (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">AI Available</Badge>
                      <span className="text-sm font-medium text-gray-900">Data Quality Checks</span>
                    </div>
                    <p className="text-xs text-gray-700 mb-2">
                      Apply AI suggestions above to see recommended quality validation rules
                    </p>
                  </div>
                )}
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

            {/* Silver AI Suggestions Card - Only show for database jobs */}
            {formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName && (() => {
              const hasSilverSuggestions = !!(silverAiSuggestions && Object.keys(silverAiSuggestions).length > 0)
              console.log('[Step3] Rendering Silver AI card - hasSilverSuggestions:', hasSilverSuggestions, 'loading:', isLoadingSilverAiSuggestions, 'suggestions:', silverAiSuggestions)

              return (
                <AISuggestionCard
                  title="AI Data Quality Architect Suggestions"
                  description={`Based on analyzing ${formData.sourceConfig.databaseConfig.tableName}`}
                  suggestions={silverAiSuggestions || {}}
                  loading={isLoadingSilverAiSuggestions}
                  error={silverAiSuggestionsError}
                  onAccept={hasSilverSuggestions ? applySilverAiSuggestions : undefined}
                  onAdjust={hasSilverSuggestions ? () => {
                    console.log('[Silver AI] Toggle expanded from', silverAiSuggestionsExpanded, 'to', !silverAiSuggestionsExpanded)
                    setSilverAiSuggestionsExpanded(!silverAiSuggestionsExpanded)
                  } : undefined}
                  isExpanded={hasSilverSuggestions && silverAiSuggestionsExpanded}
                  onToggleExpand={hasSilverSuggestions ? () => {
                    console.log('[Silver AI] onToggleExpand from', silverAiSuggestionsExpanded, 'to', !silverAiSuggestionsExpanded)
                    setSilverAiSuggestionsExpanded(!silverAiSuggestionsExpanded)
                  } : undefined}
                  usingFallback={usingFallbackSilver}
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

            {/* Gold AI Suggestions Card - Only show for database jobs */}
            {formData.type === 'database' && formData.sourceConfig.databaseConfig?.tableName && (() => {
              const hasGoldSuggestions = !!(goldAiSuggestions && Object.keys(goldAiSuggestions).length > 0)
              console.log('[Step4] Rendering Gold AI card - hasGoldSuggestions:', hasGoldSuggestions, 'loading:', isLoadingGoldAiSuggestions, 'suggestions:', goldAiSuggestions)

              return (
                <div className="mb-4 space-y-3">
                  {/* Business Context Input */}
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

                  {/* AI Suggestions Card */}
                  <AISuggestionCard
                    title="AI Analytics Architect Suggestions"
                    description={`Based on analyzing ${formData.sourceConfig.databaseConfig.tableName}${businessContext ? ' with business context' : ''}`}
                    suggestions={goldAiSuggestions || {}}
                    loading={isLoadingGoldAiSuggestions}
                    error={goldAiSuggestionsError}
                    onAccept={hasGoldSuggestions ? applyGoldAiSuggestions : undefined}
                    onAdjust={hasGoldSuggestions ? () => {
                      console.log('[Gold AI] Toggle expanded from', goldAiSuggestionsExpanded, 'to', !goldAiSuggestionsExpanded)
                      setGoldAiSuggestionsExpanded(!goldAiSuggestionsExpanded)
                    } : undefined}
                    isExpanded={hasGoldSuggestions && goldAiSuggestionsExpanded}
                    onToggleExpand={hasGoldSuggestions ? () => {
                      console.log('[Gold AI] onToggleExpand from', goldAiSuggestionsExpanded, 'to', !goldAiSuggestionsExpanded)
                      setGoldAiSuggestionsExpanded(!goldAiSuggestionsExpanded)
                    } : undefined}
                    usingFallback={usingFallbackGold}
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
                      {mode === 'edit' ? ' Click "Save Changes" to update this job.' : ' Click "Create Job" to add this job to your workflow.'}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )

      case 5:
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
              {currentStep < 5 ? (
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

    <ToastContainer toasts={toast.toasts} onDismiss={toast.dismissToast} />
  </>
  )
}