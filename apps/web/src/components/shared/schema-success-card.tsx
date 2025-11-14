"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import { CheckCircle2, Eye, X, Clock, Sparkles, ChevronDown, ChevronUp, Key, AlertCircle } from "lucide-react"

interface SchemaColumn {
  name: string
  type: string
  sample?: string
  nonEmptyCount?: number
  nullPercentage?: number
  uniqueValues?: number
  is_nullable?: boolean
  max_length?: number
  data_type?: string
  column_name?: string
}

interface SchemaSuccessCardProps {
  sourceName: string
  sourceType: 'file' | 'database'
  schema: SchemaColumn[]
  rowCount?: number
  fileSize?: number
  metadata?: {
    dbType?: string
    connectionName?: string
  }
  showAiBadge?: boolean
  onViewDetails?: () => void
  onClear?: () => void
  expandInline?: boolean // If true, show expandable details inline instead of modal
  previewData?: any[] // Optional preview data for inline display
}

export function SchemaSuccessCard({
  sourceName,
  sourceType,
  schema,
  rowCount,
  fileSize,
  metadata,
  showAiBadge = true,
  onViewDetails,
  onClear,
  expandInline = false,
  previewData
}: SchemaSuccessCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const formatSize = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2)
  }

  const getMetadataText = () => {
    const parts: string[] = []

    if (sourceType === 'database' && metadata?.dbType) {
      parts.push(metadata.dbType)
    } else if (sourceType === 'file' && fileSize) {
      parts.push(`${formatSize(fileSize)} MB`)
    }

    parts.push(`${schema.length} columns`)

    if (rowCount) {
      parts.push(sourceType === 'database' ? `${rowCount} rows (sample)` : `${rowCount} rows loaded`)
    }

    return parts.join(' • ')
  }

  const getColumnName = (col: SchemaColumn) => col.name || col.column_name || 'Unknown'
  const getDataType = (col: SchemaColumn) => {
    const type = col.type || col.data_type || 'unknown'
    if (col.max_length) return `${type}(${col.max_length})`
    return type
  }

  // Calculate statistics
  const typedColumns = schema.filter(col => {
    const type = (col.type || col.data_type || '').toLowerCase()
    return !['text', 'varchar', 'char', 'string', 'nvarchar'].includes(type)
  }).length

  const specialTypes = schema.filter(col => {
    const colName = getColumnName(col).toLowerCase()
    return colName.includes('email') || colName.includes('phone') || colName.includes('date')
  }).length

  const sparseColumns = schema.filter(col => {
    if (col.is_nullable === false) return false
    return true
  }).length

  // Debug logging
  React.useEffect(() => {
    console.log('[SchemaSuccessCard] Props:', {
      sourceName,
      sourceType,
      schemaLength: schema?.length,
      previewDataLength: previewData?.length,
      rowCount,
      expandInline
    })
  }, [sourceName, sourceType, schema, previewData, rowCount, expandInline])

  return (
    <div className="space-y-6">
      {/* AI Badge */}
      {showAiBadge && (
        <div className="flex items-center justify-center gap-2">
          <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200">
            <Sparkles className="w-3 h-3 mr-1" />
            AI-Powered Validation
          </Badge>
        </div>
      )}

      {/* Success Card */}
      <div className="border-2 border-dashed border-success rounded-lg">
        <div className="p-8 text-center">
          <div className="space-y-3">
            <CheckCircle2 className="w-8 h-8 text-success mx-auto" />
            <div>
              <p className="font-medium text-foreground">{sourceName}</p>
              <p className="text-sm text-foreground-muted">
                {getMetadataText()}
              </p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
              <div className="flex items-center justify-center gap-2 text-green-700 text-sm font-medium">
                <Clock className="w-4 h-4" />
                <span>{sourceType === 'database' ? 'Table Connected & Ready' : 'File Staged for Upload'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-center pt-2">
              {onClear && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                >
                  <X className="w-4 h-4 mr-2" />
                  Remove {sourceType === 'database' ? 'Table' : 'File'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards - 4 column grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border-2 border-blue-200 p-3">
          <div className="text-2xl font-bold text-blue-700">{schema.length}</div>
          <div className="text-xs text-blue-600 font-medium">Columns</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-green-200 p-3">
          <div className="text-2xl font-bold text-green-700">{rowCount || 0}</div>
          <div className="text-xs text-green-600 font-medium">{sourceType === 'database' ? 'Rows Loaded' : 'Rows Loaded'}</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-purple-200 p-3">
          <div className="text-2xl font-bold text-purple-700">{typedColumns}</div>
          <div className="text-xs text-purple-600 font-medium">Typed Columns</div>
        </div>
        <div className="bg-white rounded-lg border-2 border-amber-200 p-3">
          <div className="text-2xl font-bold text-amber-700">{sparseColumns}</div>
          <div className="text-xs text-amber-600 font-medium">Sparse Columns</div>
        </div>
      </div>

      {/* Column Schema Analysis Table */}
      <div className="border rounded-lg bg-white">
        <div className="p-4 border-b bg-background-secondary/30">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-base">Column Schema Analysis</h4>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Eye className="w-4 h-4 mr-2" />
              {isExpanded ? 'Hide' : 'Show'} Data Preview
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-background-secondary/50">
              <tr>
                <th className="text-left p-3 font-semibold">#</th>
                <th className="text-left p-3 font-semibold">Column Name</th>
                <th className="text-left p-3 font-semibold">Data Type</th>
                <th className="text-left p-3 font-semibold">Sample Value</th>
                <th className="text-left p-3 font-semibold">Data Quality</th>
              </tr>
            </thead>
            <tbody>
              {schema.map((col, index) => {
                const colName = getColumnName(col)
                const isPrimaryKey = colName.toLowerCase().includes('_id') || colName.toLowerCase() === 'id'
                const isRequired = col.is_nullable === false

                return (
                  <tr key={index} className="border-t hover:bg-background-secondary/50">
                    <td className="p-3 text-foreground-muted">{index + 1}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {isPrimaryKey && <Key className="w-3 h-3 text-amber-600" title="Likely Primary Key" />}
                        <span className="font-mono text-xs">{colName}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-xs font-mono">
                        {getDataType(col)}
                      </Badge>
                    </td>
                    <td className="p-3 text-xs text-foreground-muted max-w-[200px] truncate">
                      {col.sample || '-'}
                    </td>
                    <td className="p-3">
                      <span className="text-xs text-green-700">✓ {rowCount || 0} filled</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Preview - Collapsible */}
      {isExpanded && previewData && previewData.length > 0 && (
        <div className="border rounded-lg bg-white">
          <div className="p-4 border-b bg-background-secondary/30">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              <h4 className="font-semibold text-base">Data Preview - First {previewData.length} Rows</h4>
            </div>
            <p className="text-xs text-foreground-muted mt-1">Showing {previewData.length} of {rowCount || previewData.length} rows</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-background-secondary/50">
                <tr>
                  <th className="text-left p-2 font-semibold">#</th>
                  {Object.keys(previewData[0]).slice(0, 8).map((key) => (
                    <th key={key} className="text-left p-2 font-semibold whitespace-nowrap">
                      {key}
                      <div className="text-[10px] font-normal text-foreground-muted">
                        {schema.find(s => getColumnName(s) === key)?.type || schema.find(s => getColumnName(s) === key)?.data_type || 'string'}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.slice(0, 20).map((row, index) => (
                  <tr key={index} className="border-t hover:bg-background-secondary/50">
                    <td className="p-2 text-foreground-muted">{index + 1}</td>
                    {Object.values(row).slice(0, 8).map((value: any, cellIndex) => (
                      <td key={cellIndex} className="p-2 text-foreground whitespace-nowrap max-w-[150px] truncate">
                        {value === null || value === undefined ? <span className="italic text-foreground-muted">null</span> : value?.toString() || '-'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI-Detected Schema Intelligence */}
      <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-blue-600" />
          <h4 className="font-semibold text-sm text-blue-900">AI-Detected Schema Intelligence</h4>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-xl font-bold text-blue-700">{schema.length}</div>
            <div className="text-xs text-blue-600 font-medium">Columns Detected</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-xl font-bold text-blue-700">{rowCount || 0}</div>
            <div className="text-xs text-blue-600 font-medium">Sample Rows</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-xl font-bold text-green-700">{typedColumns}</div>
            <div className="text-xs text-green-600 font-medium">Typed Columns</div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-blue-200">
            <div className="text-xl font-bold text-purple-700">{specialTypes}</div>
            <div className="text-xs text-purple-600 font-medium">Special Types</div>
          </div>
        </div>
        <p className="text-xs text-blue-700 mt-3 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Table names have been auto-generated based on your source. You can customize them in the next step.
        </p>
      </div>
    </div>
  )
}
