"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Sparkles, Edit2, Check, X } from "lucide-react"

export interface ColumnSuggestion {
  position: number
  originalName?: string
  suggestedName: string
  reasoning: string
  dataType: string
  sampleValues: string[]
  confidence: number
}

interface ColumnNameEditorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  columns: ColumnSuggestion[]
  onAccept: (columnNames: string[]) => void
  onUseDefaults: () => void
}

export function ColumnNameEditorModal({
  open,
  onOpenChange,
  columns,
  onAccept,
  onUseDefaults
}: ColumnNameEditorModalProps) {
  const [editedColumns, setEditedColumns] = React.useState<ColumnSuggestion[]>(columns ?? [])
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null)
  const [editValue, setEditValue] = React.useState("")

  React.useEffect(() => {
    setEditedColumns(columns ?? [])
  }, [columns])

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setEditValue(editedColumns[index].suggestedName)
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      const updated = [...editedColumns]
      updated[editingIndex] = {
        ...updated[editingIndex],
        suggestedName: editValue
      }
      setEditedColumns(updated)
      setEditingIndex(null)
      setEditValue("")
    }
  }

  const handleCancelEdit = () => {
    setEditingIndex(null)
    setEditValue("")
  }

  const handleAcceptAll = () => {
    const columnNames = editedColumns.map(col => col.suggestedName)
    onAccept(columnNames)
    onOpenChange(false)
  }

  const handleUseDefaults = () => {
    onUseDefaults()
    onOpenChange(false)
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600 bg-green-50'
    if (confidence >= 70) return 'text-blue-600 bg-blue-50'
    if (confidence >= 50) return 'text-yellow-600 bg-yellow-50'
    return 'text-orange-600 bg-orange-50'
  }

  const getDataTypeColor = (dataType: string) => {
    switch (dataType.toLowerCase()) {
      case 'integer':
        return 'bg-blue-100 text-blue-800'
      case 'decimal':
      case 'float':
        return 'bg-green-100 text-green-800'
      case 'string':
        return 'bg-gray-100 text-gray-800'
      case 'email':
        return 'bg-orange-100 text-orange-800'
      case 'phone':
        return 'bg-pink-100 text-pink-800'
      case 'date':
      case 'datetime':
        return 'bg-purple-100 text-purple-800'
      case 'boolean':
        return 'bg-indigo-100 text-indigo-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Column Name Suggestions
          </DialogTitle>
          <DialogDescription>
            AI detected this CSV has no header row. Based on your data, here are intelligent column name suggestions.
            You can accept them, edit individual names, or use default names (Column_1, Column_2, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="space-y-3">
            {editedColumns.map((col, index) => (
              <div
                key={col.position}
                className="border border-border rounded-lg p-4 hover:bg-background-secondary transition-colors"
              >
                {editingIndex === index ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="px-2 py-1 font-mono">
                        Column {col.position}
                      </Badge>
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1"
                        placeholder="Enter column name"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveEdit()
                          if (e.key === 'Escape') handleCancelEdit()
                        }}
                      />
                      <Button size="sm" onClick={handleSaveEdit}>
                        <Check className="w-4 h-4 mr-1" />
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                        <X className="w-4 h-4 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="px-2 py-1 font-mono text-xs">
                          Col {col.position}
                        </Badge>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-foreground">
                              {col.suggestedName}
                            </span>
                            <Badge className={getDataTypeColor(col.dataType)}>
                              {col.dataType}
                            </Badge>
                            <Badge variant="outline" className={`text-xs ${getConfidenceColor(col.confidence)}`}>
                              {col.confidence}% confidence
                            </Badge>
                          </div>
                          <p className="text-sm text-foreground-muted mt-1">
                            {col.reasoning}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(index)}
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>

                    <div className="bg-gray-50 rounded-md p-3 border border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-2">Sample Values:</p>
                      <div className="flex flex-wrap gap-2">
                        {col.sampleValues.slice(0, 3).map((value, idx) => (
                          <span
                            key={idx}
                            className="font-mono text-xs bg-white px-2 py-1 rounded border border-gray-300 text-foreground"
                          >
                            {value || <span className="text-gray-400 italic">null</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center text-sm text-foreground-muted">
            <Sparkles className="w-4 h-4 mr-2 text-purple-600" />
            <span>AI analyzed your data to suggest these names</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleUseDefaults}>
              Use Default Names (Column_1...)
            </Button>
            <Button onClick={handleAcceptAll}>
              <Check className="w-4 h-4 mr-2" />
              Accept AI Suggestions
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
