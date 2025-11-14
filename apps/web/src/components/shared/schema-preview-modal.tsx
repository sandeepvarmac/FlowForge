"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui"
import { Key } from "lucide-react"

interface SchemaColumn {
  name?: string
  column_name?: string
  type?: string
  data_type?: string
  sample?: string
  is_nullable?: boolean
  max_length?: number
  numeric_precision?: number
  numeric_scale?: number
  nonEmptyCount?: number
  nullPercentage?: number
  uniqueValues?: number
}

interface SchemaPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tableName: string
  schema: SchemaColumn[]
  sourceType: 'file' | 'database'
  previewData?: any[]
  rowCount?: number
}

export function SchemaPreviewModal({
  open,
  onOpenChange,
  tableName,
  schema,
  sourceType,
  previewData,
  rowCount
}: SchemaPreviewModalProps) {
  const getColumnName = (col: SchemaColumn) => col.name || col.column_name || 'Unknown'
  const getDataType = (col: SchemaColumn) => {
    const type = col.type || col.data_type || 'unknown'
    if (col.max_length) return `${type}(${col.max_length})`
    if (col.numeric_precision && col.numeric_scale) {
      return `${type}(${col.numeric_precision},${col.numeric_scale})`
    }
    return type
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Schema: {tableName}
            <Badge variant="secondary" className="text-xs">
              {schema.length} columns
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Schema Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-background-secondary">
                <tr>
                  <th className="text-left p-3 font-semibold">Column Name</th>
                  <th className="text-left p-3 font-semibold">Data Type</th>
                  <th className="text-left p-3 font-semibold">Nullable</th>
                  {sourceType === 'file' && <th className="text-left p-3 font-semibold">Sample</th>}
                  {sourceType === 'database' && <th className="text-left p-3 font-semibold">Details</th>}
                </tr>
              </thead>
              <tbody>
                {schema.map((col, index) => {
                  const colName = getColumnName(col)
                  const isPrimaryKey = colName.toLowerCase().includes('_id') || colName.toLowerCase() === 'id'

                  return (
                    <tr key={index} className="border-t hover:bg-background-secondary/50">
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
                      <td className="p-3">
                        <Badge variant={col.is_nullable === false ? "success" : "secondary"} className="text-xs">
                          {col.is_nullable === false ? 'NOT NULL' : col.is_nullable === true ? 'NULL' : 'N/A'}
                        </Badge>
                      </td>
                      {sourceType === 'file' && (
                        <td className="p-3">
                          <span className="text-xs text-foreground-muted truncate block max-w-[200px]">
                            {col.sample || '-'}
                          </span>
                        </td>
                      )}
                      {sourceType === 'database' && (
                        <td className="p-3 text-xs text-foreground-muted">
                          {col.max_length && `Max: ${col.max_length}`}
                          {col.numeric_precision && ` Precision: ${col.numeric_precision}`}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Data Quality Metrics */}
          {sourceType === 'file' && schema.some(col => col.nullPercentage !== undefined) && (
            <div className="border rounded-lg p-4 bg-background-secondary/30">
              <h4 className="font-semibold text-sm mb-3">Data Quality Metrics</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-foreground-muted">Average NULL %</p>
                  <p className="font-semibold">
                    {(schema.reduce((sum, col) => sum + (col.nullPercentage || 0), 0) / schema.length).toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-foreground-muted">Total Rows</p>
                  <p className="font-semibold">{rowCount || '-'}</p>
                </div>
                <div>
                  <p className="text-foreground-muted">Columns</p>
                  <p className="font-semibold">{schema.length}</p>
                </div>
              </div>
            </div>
          )}

          {/* Preview Data */}
          {previewData && previewData.length > 0 && (
            <div>
              <h4 className="font-semibold text-sm mb-3">Data Preview (First {previewData.length} rows)</h4>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-background-secondary">
                    <tr>
                      {Object.keys(previewData[0]).map((key) => (
                        <th key={key} className="text-left p-2 font-semibold whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.slice(0, 10).map((row, index) => (
                      <tr key={index} className="border-t hover:bg-background-secondary/50">
                        {Object.values(row).map((value: any, cellIndex) => (
                          <td key={cellIndex} className="p-2 text-foreground-muted whitespace-nowrap">
                            {value?.toString() || '-'}
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
      </DialogContent>
    </Dialog>
  )
}
