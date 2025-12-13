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
  // Column exclusion props (for parity with Storage Connection)
  excludedColumns?: string[]
  onExcludedColumnsChange?: (excludedColumns: string[]) => void
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
  previewData,
  excludedColumns = [],
  onExcludedColumnsChange
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
        <div className="overflow-x-auto max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-background-secondary/50 sticky top-0">
              <tr>
                {onExcludedColumnsChange && (
                  <th className="text-left p-2 font-semibold text-foreground-muted w-16">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={excludedColumns.length === 0}
                        onChange={(e) => {
                          const allColumns = schema.map(c => getColumnName(c))
                          onExcludedColumnsChange(e.target.checked ? [] : allColumns)
                        }}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                      />
                      <span>Include</span>
                    </div>
                  </th>
                )}
                <th className="text-left p-2 font-semibold text-foreground-muted">#</th>
                <th className="text-left p-2 font-semibold text-foreground-muted">Column Name</th>
                <th className="text-left p-2 font-semibold text-foreground-muted">Data Type</th>
                <th className="text-left p-2 font-semibold text-foreground-muted">Sample Value</th>
                <th className="text-left p-2 font-semibold text-foreground-muted">Nullable</th>
              </tr>
            </thead>
            <tbody>
              {schema.map((col, index) => {
                const colName = getColumnName(col)
                const colType = getDataType(col).toLowerCase()
                const isExcluded = excludedColumns.includes(colName)
                const isNullable = col.is_nullable !== false

                return (
                  <tr key={index} className={`border-t hover:bg-background-secondary/50 transition-colors ${isExcluded ? 'opacity-50 bg-gray-50' : ''}`}>
                    {onExcludedColumnsChange && (
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={!isExcluded}
                          onChange={(e) => {
                            const newExcluded = e.target.checked
                              ? excludedColumns.filter(c => c !== colName)
                              : [...excludedColumns, colName]
                            onExcludedColumnsChange(newExcluded)
                          }}
                          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        />
                      </td>
                    )}
                    <td className="p-2 text-foreground-muted font-mono text-xs">{index + 1}</td>
                    <td className="p-2">
                      <div className="font-medium text-foreground font-mono text-xs">{colName}</div>
                    </td>
                    <td className="p-2">
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          colType.includes('int') || colType === 'integer' || colType === 'bigint' ? 'bg-blue-100 text-blue-800' :
                          colType.includes('float') || colType.includes('decimal') || colType.includes('numeric') || colType === 'real' || colType === 'money' ? 'bg-green-100 text-green-800' :
                          colType.includes('date') || colType.includes('time') ? 'bg-purple-100 text-purple-800' :
                          colType === 'bit' || colType === 'boolean' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {getDataType(col)}
                      </Badge>
                    </td>
                    <td className="p-2 max-w-xs">
                      <div className="truncate font-mono text-xs bg-gray-50 px-2 py-1 rounded border">
                        {col.sample || '—'}
                      </div>
                    </td>
                    <td className="p-2">
                      {isNullable ? (
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

    </div>
  )
}
