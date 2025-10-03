"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Upload, FileText, AlertCircle, CheckCircle2, Eye, X } from "lucide-react"

interface CSVFileUploadProps {
  onFileUpload: (file: File, schema: Array<{ name: string; type: string; sample?: string }>, preview: any[]) => void
  expectedColumns?: string[]
  maxSizeInMB?: number
  // Props for data persistence
  initialFile?: File
  initialSchema?: Array<{ name: string; type: string; sample?: string }>
  initialPreview?: any[]
}

interface UploadState {
  isDragging: boolean
  isProcessing: boolean
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
}

export function CSVFileUpload({ 
  onFileUpload, 
  expectedColumns = [], 
  maxSizeInMB = 10,
  initialFile,
  initialSchema,
  initialPreview
}: CSVFileUploadProps) {
  const [state, setState] = React.useState<UploadState>({
    isDragging: false,
    isProcessing: false,
    file: initialFile || null,
    error: null,
    schema: initialSchema || null,
    preview: initialPreview || null,
    showPreview: !!(initialFile && initialSchema && initialPreview)
  })

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const detectDataType = (value: string): string => {
    if (!value || value.trim() === '') return 'string'
    
    const trimmed = value.trim()
    
    // Check if it's a number (but exclude phone numbers that look like numbers)
    if (!isNaN(Number(trimmed)) && !(/^[\+\-\(\)\s\d]+$/.test(trimmed) && trimmed.length > 7)) {
      return trimmed.includes('.') ? 'decimal' : 'integer'
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
    
    return 'string'
  }

  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    // Split on actual newlines, not escaped ones
    const lines = text.split(/\r?\n/).filter(line => line.trim())
    console.log('Total lines found:', lines.length)
    console.log('First few lines:', lines.slice(0, 3))
    
    if (lines.length === 0) throw new Error('Empty CSV file')
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
    console.log('Parsed headers:', headers)
    console.log('Header count:', headers.length)
    
    const rows = lines.slice(1).map(line => {
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
    setState(prev => ({ ...prev, isProcessing: true, error: null }))
    
    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please upload a CSV file')
      }
      
      // Validate file size
      if (file.size > maxSizeInMB * 1024 * 1024) {
        throw new Error(`File size must be less than ${maxSizeInMB}MB`)
      }
      
      // Read and parse CSV
      const text = await file.text()
      console.log('CSV Text Preview:', text.substring(0, 200) + '...')
      
      const { headers, rows } = parseCSV(text)
      console.log('Parsed Headers:', headers)
      console.log('Parsed Rows Count:', rows.length)
      console.log('First Row Sample:', rows[0])
      
      if (headers.length === 0) {
        throw new Error('No headers found in CSV file')
      }
      
      // Generate schema by analyzing all rows for accurate type detection
      const schema = headers.map((header, columnIndex) => {
        // Get all values for this column
        const allValues = rows.map(row => row[columnIndex] || '').filter(cell => cell && cell.trim())
        const samples = allValues.slice(0, 10) // Use first 10 for type detection
        const types = samples.map(detectDataType)
        
        console.log(`Column "${header}":`, {
          totalValues: rows.length,
          nonEmptyValues: allValues.length,
          samples: samples.slice(0, 3),
          detectedTypes: types.slice(0, 3)
        })
        
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
      
      setState(prev => ({
        ...prev,
        isProcessing: false,
        file,
        schema,
        preview,
        showPreview: true
      }))
      
      // Notify parent component
      onFileUpload(file, schema, preview)
      
    } catch (error) {
      setState(prev => ({
        ...prev,
        isProcessing: false,
        error: error instanceof Error ? error.message : 'Failed to process file'
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
      file: null,
      error: null,
      schema: null,
      preview: null,
      showPreview: false
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
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
            <div className="space-y-3">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-sm text-foreground-muted">Processing CSV file...</p>
            </div>
          ) : state.file ? (
            <div className="space-y-3">
              <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
              <div>
                <p className="font-medium text-foreground">{state.file.name}</p>
                <p className="text-sm text-foreground-muted">
                  {(state.file.size / 1024).toFixed(1)} KB • {state.schema?.length || 0} columns • {state.preview?.length || 0} rows loaded
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
                <p className="font-medium text-foreground">Upload your CSV file</p>
                <p className="text-sm text-foreground-muted mt-1">
                  Drag and drop your file here, or click to browse
                </p>
                <p className="text-xs text-foreground-muted mt-2">
                  Supports CSV files up to {maxSizeInMB}MB
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
        accept=".csv"
        onChange={handleFileSelect}
        className="hidden"
      />

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
      {state.schema && (
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
      {state.showPreview && state.preview && (
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
    </div>
  )
}