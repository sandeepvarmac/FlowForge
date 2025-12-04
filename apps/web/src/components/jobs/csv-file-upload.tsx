"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Upload, FileText, AlertCircle, CheckCircle2, Eye, X, Sparkles, Clock } from "lucide-react"
import { ColumnNameEditorModal, type ColumnSuggestion } from "./column-name-editor-modal"

interface CSVFileUploadProps {
  onFileUpload: (
    file: File,
    schema: Array<{ name: string; type: string; sample?: string }>,
    preview: any[],
    columnMappings?: Array<{ sourceColumn: string; targetColumn: string; dataType: string }>,
    metadata?: {
      temporal_columns: string[]
      pk_candidates: string[]
    }
  ) => void
  expectedColumns?: string[]
  maxSizeInMB?: number
  // Props for data persistence
  initialFile?: File
  initialSchema?: Array<{ name: string; type: string; sample?: string }>
  initialPreview?: any[]
  // Reset callback
  onReset?: () => void
}

interface UploadState {
  isDragging: boolean
  isProcessing: boolean
  processingStep?: 'validating' | 'ai-analyzing' | 'detecting-headers' | 'generating-schema' | 'complete'
  progressPercent?: number
  file: File | null
  error: string | null
  schema: Array<{
    name: string;
    type: string;
    sample?: string;
    nonEmptyCount?: number;
    nullPercentage?: number;
    uniqueValues?: number;
  }> | null
  preview: any[] | null
  showPreview: boolean
  aiValidation: {
    fileSizeWarning?: string
    headerDetection?: {
      hasHeader: boolean
      confidence: number
      reasoning: string
      needsUserInput: boolean
      aiSuggestedColumns?: ColumnSuggestion[]
    }
  } | null
  showColumnNamingModal: boolean
  pendingFileData?: {
    file: File
    rawText: string
    rows: string[][]
  }
}

export const CSVFileUpload = React.forwardRef<{ reset: () => void }, CSVFileUploadProps>(
  function CSVFileUpload({
    onFileUpload,
    expectedColumns = [],
    maxSizeInMB = 100,
    initialFile,
    initialSchema,
    initialPreview,
    onReset
  }, ref) {
  const [state, setState] = React.useState<UploadState>({
    isDragging: false,
    isProcessing: false,
    file: initialFile || null,
    error: null,
    schema: initialSchema || null,
    preview: initialPreview || null,
    showPreview: !!(initialFile && initialSchema && initialPreview),
    aiValidation: null,
    showColumnNamingModal: false,
    pendingFileData: undefined
  })

  const [isMounted, setIsMounted] = React.useState(false)

  React.useEffect(() => {
    setIsMounted(true)
  }, [])

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Expose reset function via ref
  React.useImperativeHandle(ref, () => ({
    reset: clearFile
  }))

  const detectDataType = (value: string): string => {
    if (!value || value.trim() === '') return 'string'

    const trimmed = value.trim()

    // Check if it's a number (but exclude phone numbers that look like numbers)
    if (!isNaN(Number(trimmed)) && !(/^[\+\-\(\)\s\d]+$/.test(trimmed) && trimmed.length > 7)) {
      return trimmed.includes('.') ? 'decimal' : 'integer'
    }

    // Check if it's a datetime (ISO format or common datetime formats)
    if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}/.test(trimmed) && !isNaN(Date.parse(trimmed))) {
      return 'timestamp'
    }

    // Check if it's a date (YYYY-MM-DD format)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(Date.parse(trimmed))) {
      return 'date'
    }

    // Check if it's an email
    if (/@/.test(trimmed) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return 'email'
    }

    // Check if it's a phone number (contains digits and phone-like characters)
    if (/[\+\d\s\-\(\)\.]+/.test(trimmed) && /\d/.test(trimmed) && trimmed.replace(/[\+\d\s\-\(\)\.]/g, '').length <= 2) {
      return 'phone'
    }

    // Check if it's a URL
    if (/^https?:\/\//i.test(trimmed) || /^www\./i.test(trimmed)) {
      return 'url'
    }

    return 'string'
  }

  // Helper function to detect temporal columns (for incremental loading)
  const detectTemporalColumns = (schema: Array<{ name: string; type: string }>): string[] => {
    const temporalTypes = ['date', 'timestamp', 'datetime']
    const temporalPatterns = ['created', 'updated', 'modified', 'timestamp', 'date', 'time', '_at', '_on']

    return schema
      .filter(col => {
        // Check if column type is temporal
        if (temporalTypes.includes(col.type)) {
          return true
        }
        // Check if column name contains temporal keywords
        const lowerName = col.name.toLowerCase()
        return temporalPatterns.some(pattern => lowerName.includes(pattern))
      })
      .map(col => col.name)
  }

  // Helper function to detect primary key candidates
  const detectPKCandidates = (schema: Array<{ name: string; type: string }>): string[] => {
    const pkPatterns = ['id', '_id', 'key', 'pk', 'code', 'uuid', 'guid']

    return schema
      .filter(col => {
        const lowerName = col.name.toLowerCase()
        // Check if column name matches PK patterns
        return pkPatterns.some(pattern =>
          lowerName === pattern ||
          lowerName.endsWith('_' + pattern) ||
          lowerName.startsWith(pattern + '_')
        )
      })
      .map(col => col.name)
  }

  const parseCSV = (text: string, customHeaders?: string[]): { headers: string[]; rows: string[][] } => {
    // Split on actual newlines, not escaped ones
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    console.log('Total lines found:', lines.length)
    console.log('First few lines:', lines.slice(0, 3))

    if (lines.length === 0) throw new Error('Empty CSV file')

    // Use custom headers if provided, otherwise parse from first row
    const headers = customHeaders || lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    console.log('Parsed headers:', headers)
    console.log('Header count:', headers.length)

    // If custom headers provided, don't skip first row (it's data)
    const dataStartIndex = customHeaders ? 0 : 1
    const rows = lines.slice(dataStartIndex).map(line => {
      const cells = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      // Ensure each row has the same number of columns as headers
      while (cells.length < headers.length) {
        cells.push('')
      }
      return cells.slice(0, headers.length) // Trim any extra columns
    }).filter(row => row.some(cell => cell.trim())) // Remove completely empty rows

    console.log('Parsed rows count:', rows.length)
    console.log('First row sample:', rows[0])

    return { headers, rows }
  }

  const processFile = async (file: File) => {
    setState(prev => ({ ...prev, isProcessing: true, processingStep: 'validating', error: null, aiValidation: null }))

    try {
      console.log('🤖 Starting AI-powered CSV validation (chunked)...')

      // Step 1: Basic validation (30% progress)
      setState(prev => ({ ...prev, processingStep: 'validating', progressPercent: 0 }))

      const basicFormData = new FormData()
      basicFormData.append('file', file)

      const basicResponse = await fetch('/api/validate-csv-basic', {
        method: 'POST',
        body: basicFormData
      })

      const basicResult = await basicResponse.json()

      if (!basicResult.success) {
        throw new Error(basicResult.error || 'Basic validation failed')
      }

      console.log('✅ Step 1/3: Basic validation complete (30%)', basicResult.validation)
      setState(prev => ({ ...prev, progressPercent: 30 }))

      // Step 2: AI header detection (70% progress)
      setState(prev => ({ ...prev, processingStep: 'ai-analyzing', progressPercent: 30 }))

      const headerResponse = await fetch('/api/validate-csv-headers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstThreeRows: basicResult.metadata.firstThreeRows
        })
      })

      const headerResult = await headerResponse.json()

      if (!headerResult.success) {
        throw new Error(headerResult.error || 'Header detection failed')
      }

      console.log('✅ Step 2/3: Header detection complete (70%)', headerResult.headerDetection)
      setState(prev => ({ ...prev, processingStep: 'detecting-headers', progressPercent: 70 }))

      // Step 3: Schema generation (100% progress)
      setState(prev => ({ ...prev, processingStep: 'generating-schema', progressPercent: 70 }))

      const schemaResponse = await fetch('/api/validate-csv-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstThreeRows: basicResult.metadata.firstThreeRows,
          hasHeader: headerResult.headerDetection.hasHeader,
          rowCount: basicResult.metadata.rowCount
        })
      })

      const schemaResult = await schemaResponse.json()

      if (!schemaResult.success) {
        throw new Error(schemaResult.error || 'Schema generation failed')
      }

      console.log('✅ Step 3/3: Schema generation complete (100%)', schemaResult.schema)
      setState(prev => ({ ...prev, progressPercent: 100 }))

      // Combine results
      const validationResult = {
        success: true,
        validation: {
          fileFormat: basicResult.validation.fileFormat,
          fileSize: basicResult.validation.fileSize,
          isEmpty: basicResult.validation.isEmpty,
          headerDetection: {
            ...headerResult.headerDetection,
            aiSuggestedColumns: schemaResult.schema.aiSuggestedColumns,
            suggestedHeaders: schemaResult.schema.suggestedHeaders
          }
        }
      }

      console.log('✅ All validation steps complete:', validationResult.validation)

      // Check individual validations
      if (!validationResult.validation.fileFormat.valid) {
        throw new Error(validationResult.validation.fileFormat.message)
      }

      if (!validationResult.validation.isEmpty.valid) {
        throw new Error(validationResult.validation.isEmpty.message || 'File is empty')
      }

      // Store AI validation results
      setState(prev => ({ ...prev, processingStep: 'detecting-headers' }))

      const aiValidation: UploadState['aiValidation'] = {
        fileSizeWarning: validationResult.validation.fileSize.warning,
        headerDetection: validationResult.validation.headerDetection
      }

      // Step 2: Check if AI detected no headers and suggested column names
      const text = await file.text()

      console.log('🔍 Checking for column naming modal trigger:', {
        hasHeaderDetection: !!aiValidation.headerDetection,
        hasHeader: aiValidation.headerDetection?.hasHeader,
        hasSuggestedColumns: !!aiValidation.headerDetection?.aiSuggestedColumns,
        suggestedColumnsLength: aiValidation.headerDetection?.aiSuggestedColumns?.length
      })

      if (
        aiValidation.headerDetection &&
        !aiValidation.headerDetection.hasHeader
      ) {
        const lines = text.split(/\r?\n/).filter(line => line.trim())
        const rows = lines.map(line =>
          line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        )

        if (
          (!aiValidation.headerDetection.aiSuggestedColumns ||
            aiValidation.headerDetection.aiSuggestedColumns.length === 0) &&
          schemaResult.schema.needsColumnNaming
        ) {
          const fallbackHeaders =
            schemaResult.schema.suggestedHeaders?.length
              ? schemaResult.schema.suggestedHeaders
              : Array.from({ length: rows[0]?.length || 0 }, (_, i) => `Column_${i + 1}`)

          aiValidation.headerDetection.aiSuggestedColumns = fallbackHeaders.map((name, index) => {
            const sampleValues = rows.slice(0, 3).map(row => row[index] || '')
            return {
              position: index + 1,
              originalName: `column_${index + 1}`,
              suggestedName: name,
              reasoning: 'Automatically generated from column position',
              dataType: detectDataType(sampleValues.find(value => value && value.trim()) || ''),
              sampleValues,
              confidence: 60
            }
          })
        }

        if (
          aiValidation.headerDetection.aiSuggestedColumns &&
          aiValidation.headerDetection.aiSuggestedColumns.length > 0
        ) {
          console.log('dY- No headers detected - showing column naming modal after progress completes')

          // Continue progress bar to 100%
          setState(prev => ({ ...prev, processingStep: 'generating-schema' }))

          // Small delay to show 100% progress, then show modal
          setTimeout(() => {
            setState(prev => ({
              ...prev,
              isProcessing: false,
              processingStep: 'complete',
              aiValidation,
              showColumnNamingModal: true,
              pendingFileData: {
                file,
                rawText: text,
                rows
              }
            }))
          }, 500) // Half second delay to show progress completion

          return // Wait for user to choose column names
        } else {
          console.log('?s??,? Headerless CSV detected but no AI suggestions were available, falling back to default processing.')
        }
      }

      // Step 3: Parse CSV normally (has headers)
      setState(prev => ({ ...prev, processingStep: 'generating-schema' }))

      const { headers, rows } = parseCSV(text)

      if (headers.length === 0) {
        throw new Error('No headers found in CSV file')
      }

      // Step 4: Generate schema by analyzing all rows
      const schema = headers.map((header, columnIndex) => {
        // Get all values for this column
        const allValues = rows.map(row => row[columnIndex] || '').filter(cell => cell && cell.trim())
        const samples = allValues.slice(0, 10) // Use first 10 for type detection
        const types = samples.map(detectDataType)

        // Default to 'string' if no samples or types found
        let mostCommonType = 'string'
        if (types.length > 0) {
          mostCommonType = types.reduce((a, b, i, arr) =>
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
          )
        }

        // Calculate accurate statistics
        const nonEmptyCount = allValues.length
        const totalRows = rows.length
        const nullPercentage = totalRows > 0 ? Math.round(((totalRows - nonEmptyCount) / totalRows) * 100) : 0

        return {
          name: header,
          type: mostCommonType,
          sample: samples[0] || '',
          nonEmptyCount,
          nullPercentage,
          uniqueValues: new Set(allValues.slice(0, 10)).size
        }
      })

      console.log('Generated schema:', schema)

      // Create preview data (first 20 rows)
      const preview = rows.slice(0, 20).map(row => {
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] || ''
        })
        return obj
      })

      // Detect temporal columns and PK candidates
      const temporalColumns = detectTemporalColumns(schema)
      const pkCandidates = detectPKCandidates(schema)

      console.log('CSV Metadata Detection:', {
        temporal_columns: temporalColumns,
        pk_candidates: pkCandidates
      })

      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingStep: 'complete',
        file,
        schema,
        preview,
        showPreview: true,
        aiValidation
      }))

      // Notify parent component with metadata
      onFileUpload(file, schema, preview, undefined, {
        temporal_columns: temporalColumns,
        pk_candidates: pkCandidates
      })

    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        processingStep: undefined,
        error: error instanceof Error ? error.message : 'Failed to process file',
        aiValidation: null
      }))
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setState(prev => ({ ...prev, isDragging: false }))

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      processFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      processFile(files[0])
    }
  }

  const clearFile = () => {
    setState({
      isDragging: false,
      isProcessing: false,
      processingStep: undefined,
      file: null,
      error: null,
      schema: null,
      preview: null,
      showPreview: false,
      aiValidation: null,
      showColumnNamingModal: false,
      pendingFileData: undefined
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    // Notify parent to reset as well
    onReset?.()
  }

  const handleColumnNamesAccept = (columnNames: string[]) => {
    console.log('✅ User accepted column names:', columnNames)

    if (!state.pendingFileData) {
      console.error('No pending file data!')
      return
    }

    try {
      // Re-parse CSV with custom headers
      const { headers, rows } = parseCSV(state.pendingFileData.rawText, columnNames)

      console.log('Parsed with custom headers:', { headers, rowCount: rows.length })

      // Generate schema
      const schema = headers.map((header, columnIndex) => {
        const allValues = rows.map(row => row[columnIndex] || '').filter(cell => cell && cell.trim())
        const samples = allValues.slice(0, 10)
        const types = samples.map(detectDataType)

        let mostCommonType = 'string'
        if (types.length > 0) {
          mostCommonType = types.reduce((a, b, i, arr) =>
            arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
          )
        }

        const nonEmptyCount = allValues.length
        const totalRows = rows.length
        const nullPercentage = totalRows > 0 ? Math.round(((totalRows - nonEmptyCount) / totalRows) * 100) : 0

        return {
          name: header,
          type: mostCommonType,
          sample: samples[0] || '',
          nonEmptyCount,
          nullPercentage,
          uniqueValues: new Set(allValues.slice(0, 10)).size
        }
      })

      // Create preview data
      const preview = rows.slice(0, 20).map(row => {
        const obj: any = {}
        headers.forEach((header, index) => {
          obj[header] = row[index] || ''
        })
        return obj
      })

      // Generate column mappings for headerless CSV
      // Map from position-based names (column_1, column_2, etc.) to user-selected names
      // This matches Polars' default naming convention for headerless CSVs
      const columnMappings = columnNames.map((targetName, index) => ({
        sourceColumn: `column_${index + 1}`,  // Position-based source column (what Polars generates: column_1, column_2, etc.)
        targetColumn: targetName,              // User-selected target column name
        dataType: schema[index].type           // Data type from schema analysis
      }))

      console.log('Generated column mappings:', columnMappings)

      // Detect temporal columns and PK candidates
      const temporalColumns = detectTemporalColumns(schema)
      const pkCandidates = detectPKCandidates(schema)

      console.log('CSV Metadata Detection (custom headers):', {
        temporal_columns: temporalColumns,
        pk_candidates: pkCandidates
      })

      // Update state with final schema and preview
      setState(prev => ({
        ...prev,
        file: state.pendingFileData!.file,
        schema,
        preview,
        showPreview: true,
        showColumnNamingModal: false,
        pendingFileData: undefined
      }))

      // Notify parent component with column mappings and metadata
      onFileUpload(state.pendingFileData.file, schema, preview, columnMappings, {
        temporal_columns: temporalColumns,
        pk_candidates: pkCandidates
      })

    } catch (error) {
      console.error('Error processing file with custom headers:', error)
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to process file with custom headers',
        showColumnNamingModal: false,
        pendingFileData: undefined
      }))
    }
  }

  const handleColumnNamesCancel = () => {
    console.log('❌ User cancelled column naming')
    // Clear everything and reset - including file input
    setState(prev => ({
      ...prev,
      isProcessing: false,
      showColumnNamingModal: false,
      pendingFileData: undefined,
      aiValidation: null
    }))

    // Clear the file input so user can re-select the same file
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleUseDefaultColumnNames = () => {
    console.log('🔤 User chose default column names')

    if (!state.pendingFileData) {
      console.error('No pending file data!')
      return
    }

    // Get number of columns from first row
    const firstRow = state.pendingFileData.rows[0]
    const defaultHeaders = Array.from({ length: firstRow.length }, (_, i) => `Column_${i + 1}`)

    // Process file with default headers
    handleColumnNamesAccept(defaultHeaders)
  }

  const validateColumns = () => {
    if (!state.schema || expectedColumns.length === 0) return { valid: true, missing: [] }

    const presentColumns = state.schema.map(col => col.name.toLowerCase())
    const missing = expectedColumns.filter(expected =>
      !presentColumns.includes(expected.toLowerCase())
    )

    return { valid: missing.length === 0, missing }
  }

  const columnValidation = validateColumns()

  return (
    <div className="space-y-4">
      {/* AI-Powered Badge */}
      {state.file && state.aiValidation && (
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Validation
          </Badge>
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg transition-all ${
          state.isDragging
            ? 'border-primary bg-primary-50'
            : state.file
            ? 'border-success bg-success-50'
            : 'border-border hover:border-primary-200 hover:bg-background-secondary'
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onDragEnter={() => setState(prev => ({ ...prev, isDragging: true }))}
        onDragLeave={() => setState(prev => ({ ...prev, isDragging: false }))}
      >
        <div className="p-8 text-center">
          {state.isProcessing ? (
            <div className="space-y-5 max-w-md mx-auto">
              {/* Icon with dynamic animation */}
              <div className="relative w-16 h-16 mx-auto">
                {state.processingStep === 'ai-analyzing' ? (
                  <Sparkles className="w-16 h-16 text-purple-500 animate-pulse mx-auto" />
                ) : (
                  <div className="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full"></div>
                )}
              </div>

              {/* Dynamic Status Label */}
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">
                  {state.processingStep === 'validating' && 'Checking file...'}
                  {state.processingStep === 'ai-analyzing' && (
                    <span className="flex items-center justify-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      Analyzing your data...
                    </span>
                  )}
                  {state.processingStep === 'detecting-headers' && 'Finding column names...'}
                  {state.processingStep === 'generating-schema' && 'Building data structure...'}
                  {!state.processingStep && 'Getting started...'}
                </p>
                <p className="text-sm text-foreground-muted">
                  Usually takes 10-15 seconds
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-full transition-all duration-700 ease-out"
                  style={{
                    width: `${state.progressPercent || 10}%`
                  }}
                />
              </div>

              {/* Progress Percentage */}
              {state.progressPercent !== undefined && (
                <p className="text-xs text-foreground-muted font-medium">
                  {state.progressPercent}% complete
                </p>
              )}
            </div>
          ) : state.file ? (
            <div className="space-y-3">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
              <div>
                <p className="font-medium text-foreground">{state.file.name}</p>
                <p className="text-sm text-foreground-muted">
                  {(state.file.size / 1024 / 1024).toFixed(2)} MB • {state.schema?.length || 0} columns • {state.preview?.length || 0} rows loaded
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                <div className="flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
                  <Clock className="w-4 h-4" />
                  <span>File Staged for Upload</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  This file will be uploaded when you create the job
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={clearFile}>
                <X className="w-4 h-4 mr-2" />
                Remove File
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Upload className="w-8 h-8 text-foreground-muted mx-auto" />
              <div>
                <p className="font-medium text-foreground">
                  Upload your data file
                </p>
                <p className="text-sm text-foreground-muted mt-1">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-foreground-muted mt-2">
                  Supports CSV, JSON, Parquet, Excel files up to {maxSizeInMB}MB. Format is auto-detected.
                </p>
              </div>
              <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                Browse Files
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt,.tsv,.json,.jsonl,.ndjson,.parquet,.xlsx,.xls"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* AI File Size Warning */}
      {state.aiValidation?.fileSizeWarning && (
        <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{state.aiValidation.fileSizeWarning}</span>
        </div>
      )}

      {/* AI Header Detection Info */}
      {state.aiValidation?.headerDetection && (
        <div className={`p-3 rounded-lg border ${
          state.aiValidation.headerDetection.confidence >= 80
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className={`w-4 h-4 ${
              state.aiValidation.headerDetection.confidence >= 80 ? 'text-green-600' : 'text-yellow-600'
            }`} />
            <span className={`text-sm font-medium ${
              state.aiValidation.headerDetection.confidence >= 80 ? 'text-green-700' : 'text-yellow-700'
            }`}>
              AI Header Detection: {state.aiValidation.headerDetection.confidence}% confidence
            </span>
          </div>
          <p className={`text-xs ${
            state.aiValidation.headerDetection.confidence >= 80 ? 'text-green-600' : 'text-yellow-600'
          }`}>
            {state.aiValidation.headerDetection.reasoning}
          </p>
        </div>
      )}

      {/* Error message */}
      {state.error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{state.error}</span>
        </div>
      )}

      {/* Column validation */}
      {state.schema && expectedColumns.length > 0 && (
        <div className={`p-3 rounded-lg border ${
          columnValidation.valid
            ? 'bg-green-50 border-green-200'
            : 'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-center gap-2">
            {columnValidation.valid ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-600" />
            )}
            <span className={`text-sm font-medium ${
              columnValidation.valid ? 'text-green-700' : 'text-yellow-700'
            }`}>
              Column Validation
            </span>
          </div>
          {!columnValidation.valid && (
            <p className="text-sm text-yellow-700 mt-1">
              Missing expected columns: {columnValidation.missing.join(', ')}
            </p>
          )}
        </div>
      )}

      {/* Schema Analysis */}
      {state.schema && isMounted && (
        <div className="space-y-4">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-700">{state.schema.length}</div>
              <div className="text-xs text-blue-600 font-medium">Columns</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-700">{state.preview?.length || 0}</div>
              <div className="text-xs text-green-600 font-medium">Rows Loaded</div>
            </div>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-700">
                {state.schema.filter(col => col.type !== 'string').length}
              </div>
              <div className="text-xs text-purple-600 font-medium">Typed Columns</div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-amber-700">
                {state.schema.filter(col => (col as any).nullPercentage > 10).length}
              </div>
              <div className="text-xs text-amber-600 font-medium">Sparse Columns</div>
            </div>
          </div>

          {/* Schema Table */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Column Schema Analysis</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setState(prev => ({ ...prev, showPreview: !prev.showPreview }))}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  {state.showPreview ? 'Hide' : 'Show'} Data Preview
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-semibold text-foreground-muted">#</th>
                      <th className="text-left p-3 font-semibold text-foreground-muted">Column Name</th>
                      <th className="text-left p-3 font-semibold text-foreground-muted">Data Type</th>
                      <th className="text-left p-3 font-semibold text-foreground-muted">Sample Value</th>
                      <th className="text-left p-3 font-semibold text-foreground-muted">Data Quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.schema.map((col, index) => {
                      const typedCol = col as any
                      return (
                        <tr key={index} className="border-b border-border hover:bg-background-secondary transition-colors">
                          <td className="p-3 text-foreground-muted font-mono">{index + 1}</td>
                          <td className="p-3">
                            <div className="font-medium text-foreground font-mono">{col.name}</div>
                          </td>
                          <td className="p-3">
                            <Badge
                              variant={col.type === 'string' ? 'secondary' : 'default'}
                              className={`${
                                col.type === 'integer' ? 'bg-blue-100 text-blue-800' :
                                col.type === 'decimal' ? 'bg-green-100 text-green-800' :
                                col.type === 'date' ? 'bg-purple-100 text-purple-800' :
                                col.type === 'email' ? 'bg-orange-100 text-orange-800' :
                                col.type === 'phone' ? 'bg-pink-100 text-pink-800' :
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {col.type}
                            </Badge>
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded border">
                              {col.sample || '—'}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-green-600">✓ {typedCol.nonEmptyCount} filled</span>
                              </div>
                              {typedCol.nullPercentage > 0 && (
                                <div className="flex items-center gap-2">
                                  <span className={`${
                                    typedCol.nullPercentage > 20 ? 'text-red-600' :
                                    typedCol.nullPercentage > 10 ? 'text-amber-600' :
                                    'text-gray-600'
                                  }`}>
                                    {typedCol.nullPercentage > 20 ? '⚠' : '○'} {typedCol.nullPercentage}% null
                                  </span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Data Preview */}
      {state.showPreview && state.preview && isMounted && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Data Preview - First {state.preview.length} Rows
              </CardTitle>
              <div className="text-sm text-foreground-muted">
                Showing {state.preview.length} of {Math.min(20, state.preview.length)} rows
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-border sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-foreground-muted border-r border-border bg-gray-100 sticky left-0 z-10">
                        #
                      </th>
                      {state.schema?.map((col, index) => (
                        <th key={index} className="text-left p-3 font-semibold text-foreground-muted min-w-32 border-r border-border last:border-r-0">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-xs">{col.name}</span>
                            <Badge
                              variant="outline"
                              className={`text-xs w-fit ${
                                col.type === 'integer' ? 'border-blue-300 text-blue-700' :
                                col.type === 'decimal' ? 'border-green-300 text-green-700' :
                                col.type === 'date' ? 'border-purple-300 text-purple-700' :
                                col.type === 'email' ? 'border-orange-300 text-orange-700' :
                                col.type === 'phone' ? 'border-pink-300 text-pink-700' :
                                'border-gray-300 text-gray-700'
                              }`}
                            >
                              {col.type}
                            </Badge>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {state.preview.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-b border-border hover:bg-blue-50 transition-colors">
                        <td className="p-3 font-mono text-xs text-foreground-muted font-semibold border-r border-border bg-gray-50 sticky left-0 z-10">
                          {rowIndex + 1}
                        </td>
                        {state.schema?.map((col, colIndex) => {
                          const value = row[col.name] || ''
                          const isEmpty = !value || value.toString().trim() === ''
                          return (
                            <td key={colIndex} className="p-3 border-r border-border last:border-r-0">
                              <div className={`font-mono text-xs truncate max-w-40 ${
                                isEmpty ? 'text-gray-400 italic' :
                                col.type === 'email' && !/@/.test(value) ? 'text-red-600 bg-red-50 px-1 rounded' :
                                col.type === 'integer' && isNaN(Number(value)) ? 'text-red-600 bg-red-50 px-1 rounded' :
                                'text-foreground'
                              }`} title={value}>
                                {isEmpty ? 'null' : value}
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

            {/* Data Quality Summary */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-sm mb-3 text-foreground">Quick Data Quality Summary</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Quality Level</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Column Count</th>
                      <th className="text-left py-2 px-3 font-medium text-gray-700">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                          <span className="font-medium text-green-700">Good Quality</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-green-700">
                        {state.schema?.filter(col => (col as any).nullPercentage < 5).length}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        Columns with &lt;5% missing values
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                          <span className="font-medium text-amber-700">Moderate Issues</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-amber-700">
                        {state.schema?.filter(col => (col as any).nullPercentage >= 5 && (col as any).nullPercentage < 20).length}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        Columns with 5-20% missing values
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                          <span className="font-medium text-red-700">Data Concerns</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 font-mono text-red-700">
                        {state.schema?.filter(col => (col as any).nullPercentage >= 20).length}
                      </td>
                      <td className="py-2 px-3 text-gray-600">
                        Columns with &gt;20% missing values
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Column Name Editor Modal */}
      {state.showColumnNamingModal &&
        state.aiValidation?.headerDetection?.aiSuggestedColumns &&
        state.pendingFileData && (
        <ColumnNameEditorModal
          open={state.showColumnNamingModal}
          onOpenChange={(open) => {
            if (!open) {
              handleColumnNamesCancel()
            }
          }}
          columns={state.aiValidation.headerDetection.aiSuggestedColumns}
          onAccept={handleColumnNamesAccept}
          onUseDefaults={handleUseDefaultColumnNames}
        />
      )}
    </div>
  )
})
