"use client"

import * as React from "react"
import { Button, Input, Badge } from "@/components/ui"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { FormField, FormLabel, FormError, Textarea, Select } from "@/components/ui/form"
import { Info, Layers, Database, Plus, X, Search, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"
import { TargetLayer, DatasetStatus } from "@/types/pipeline"

interface DatasetOption {
  name: string
  layer: TargetLayer
  catalogId: string
  rowCount: number
  status: DatasetStatus
  isReady: boolean
}

interface CreateDatasetJobModalProps {
  pipelineId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface FormData {
  name: string
  description: string
  targetLayer: TargetLayer
  inputDatasets: string[]
  transformSql: string
  outputTableName: string
}

const defaultFormData: FormData = {
  name: '',
  description: '',
  targetLayer: 'silver',
  inputDatasets: [],
  transformSql: '',
  outputTableName: ''
}

export function CreateDatasetJobModal({
  pipelineId,
  open,
  onOpenChange,
  onSuccess
}: CreateDatasetJobModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormData, string>>>({})
  const [formData, setFormData] = React.useState<FormData>(defaultFormData)

  // Dataset selector state
  const [availableDatasets, setAvailableDatasets] = React.useState<DatasetOption[]>([])
  const [loadingDatasets, setLoadingDatasets] = React.useState(false)
  const [datasetSearch, setDatasetSearch] = React.useState('')
  const [datasetLayerFilter, setDatasetLayerFilter] = React.useState<TargetLayer | ''>('')

  // Load available datasets when modal opens
  React.useEffect(() => {
    if (open) {
      loadAvailableDatasets()
    }
  }, [open])

  // Reset form when modal closes
  React.useEffect(() => {
    if (!open) {
      setFormData(defaultFormData)
      setErrors({})
      setDatasetSearch('')
      setDatasetLayerFilter('')
    }
  }, [open])

  const loadAvailableDatasets = async () => {
    setLoadingDatasets(true)
    try {
      const response = await fetch('/api/catalog/resolve?environment=dev')
      if (response.ok) {
        const data = await response.json()
        setAvailableDatasets(data.datasets || [])
      }
    } catch (error) {
      console.error('Failed to load datasets:', error)
    } finally {
      setLoadingDatasets(false)
    }
  }

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }))
    }
  }

  const toggleDataset = (datasetName: string) => {
    const currentDatasets = formData.inputDatasets
    if (currentDatasets.includes(datasetName)) {
      updateField('inputDatasets', currentDatasets.filter(d => d !== datasetName))
    } else {
      updateField('inputDatasets', [...currentDatasets, datasetName])
    }
  }

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Job name is required'
    }
    if (formData.inputDatasets.length === 0) {
      newErrors.inputDatasets = 'At least one input dataset is required'
    }
    if (!formData.transformSql.trim()) {
      newErrors.transformSql = 'SQL transform is required'
    }
    if (!formData.outputTableName.trim()) {
      newErrors.outputTableName = 'Output table name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${pipelineId}/dataset-jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          targetLayer: formData.targetLayer,
          inputDatasets: formData.inputDatasets,
          transformSql: formData.transformSql,
          outputTableName: formData.outputTableName
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create Dataset Job')
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error('Failed to create Dataset Job:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter datasets based on search and layer
  const filteredDatasets = availableDatasets.filter(d => {
    const matchesSearch = !datasetSearch || d.name.toLowerCase().includes(datasetSearch.toLowerCase())
    const matchesLayer = !datasetLayerFilter || d.layer === datasetLayerFilter

    // For Silver jobs, show Bronze datasets
    // For Gold jobs, show Silver datasets (and optionally Bronze)
    const validSourceLayer = formData.targetLayer === 'silver'
      ? d.layer === 'bronze'
      : d.layer === 'silver' || d.layer === 'bronze'

    return matchesSearch && matchesLayer && validSourceLayer
  })

  // Get appropriate source layers based on target
  const getSourceLayerOptions = () => {
    if (formData.targetLayer === 'silver') {
      return [{ value: 'bronze', label: 'Bronze' }]
    }
    return [
      { value: 'silver', label: 'Silver' },
      { value: 'bronze', label: 'Bronze' }
    ]
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            Create Dataset Job
          </DialogTitle>
          <DialogDescription>
            Create a new Dataset Job that transforms data across multiple sources using SQL
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel htmlFor="name" required>Job Name</FormLabel>
                <Input
                  id="name"
                  placeholder="e.g., Customer Loan Analysis"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  autoFocus
                />
                <FormError>{errors.name}</FormError>
              </FormField>

              <FormField>
                <FormLabel htmlFor="targetLayer" required>Target Layer</FormLabel>
                <Select
                  id="targetLayer"
                  value={formData.targetLayer}
                  onChange={(e) => {
                    updateField('targetLayer', e.target.value as TargetLayer)
                    // Clear selected datasets when layer changes
                    updateField('inputDatasets', [])
                    setDatasetLayerFilter('')
                  }}
                >
                  <option value="silver">Silver (Cleansed & Conformed)</option>
                  <option value="gold">Gold (Aggregated & Analytics)</option>
                </Select>
              </FormField>
            </div>

            <FormField>
              <FormLabel htmlFor="description">Description</FormLabel>
              <Textarea
                id="description"
                placeholder="Describe what this Dataset Job does..."
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={2}
              />
            </FormField>

            <FormField>
              <FormLabel htmlFor="outputTableName" required>Output Table Name</FormLabel>
              <Input
                id="outputTableName"
                placeholder={`e.g., customer_loan_analysis_${formData.targetLayer}`}
                value={formData.outputTableName}
                onChange={(e) => updateField('outputTableName', e.target.value)}
              />
              <p className="text-xs text-foreground-muted mt-1">
                <Info className="w-3 h-3 inline mr-1" />
                This will be the table name in the {formData.targetLayer} layer
              </p>
              <FormError>{errors.outputTableName}</FormError>
            </FormField>
          </div>

          {/* Input Datasets */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">
              Input Datasets
              {formData.inputDatasets.length > 0 && (
                <Badge variant="secondary" className="ml-2">{formData.inputDatasets.length} selected</Badge>
              )}
            </h3>

            {/* Selected datasets */}
            {formData.inputDatasets.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-background-secondary rounded-lg border">
                {formData.inputDatasets.map(name => {
                  const dataset = availableDatasets.find(d => d.name === name)
                  return (
                    <Badge
                      key={name}
                      variant="outline"
                      className="flex items-center gap-1 py-1 px-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${
                        dataset?.layer === 'bronze' ? 'bg-accent-orange' :
                        dataset?.layer === 'silver' ? 'bg-primary' :
                        'bg-secondary'
                      }`} />
                      {name}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-destructive ml-1"
                        onClick={() => toggleDataset(name)}
                      />
                    </Badge>
                  )
                })}
              </div>
            )}

            {/* Dataset search and filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input
                  placeholder="Search datasets..."
                  value={datasetSearch}
                  onChange={(e) => setDatasetSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select
                value={datasetLayerFilter}
                onChange={(e) => setDatasetLayerFilter(e.target.value as TargetLayer | '')}
                className="w-32"
              >
                <option value="">All Layers</option>
                {getSourceLayerOptions().map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </div>

            {/* Dataset list */}
            <div className="border rounded-lg overflow-hidden">
              {loadingDatasets ? (
                <div className="p-8 text-center text-foreground-muted">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  Loading datasets...
                </div>
              ) : filteredDatasets.length === 0 ? (
                <div className="p-8 text-center text-foreground-muted">
                  <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No datasets available</p>
                  <p className="text-xs mt-1">
                    {formData.targetLayer === 'silver'
                      ? 'Run some Bronze ingestion jobs first to create datasets'
                      : 'Create Silver datasets first, or use Bronze datasets directly'}
                  </p>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {filteredDatasets.map(dataset => {
                    const isSelected = formData.inputDatasets.includes(dataset.name)
                    return (
                      <button
                        key={dataset.catalogId}
                        type="button"
                        onClick={() => toggleDataset(dataset.name)}
                        className={`w-full flex items-center justify-between p-3 border-b last:border-b-0 hover:bg-background-secondary transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            dataset.layer === 'bronze' ? 'bg-accent-orange' :
                            dataset.layer === 'silver' ? 'bg-primary' :
                            'bg-secondary'
                          }`} />
                          <div className="text-left">
                            <p className="font-medium text-sm">{dataset.name}</p>
                            <p className="text-xs text-foreground-muted">
                              {dataset.layer} • {dataset.rowCount.toLocaleString()} rows
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {dataset.isReady ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                          {isSelected && (
                            <Badge variant="default" className="bg-primary">Selected</Badge>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <FormError>{errors.inputDatasets}</FormError>
          </div>

          {/* SQL Transform */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">SQL Transform</h3>

            <FormField>
              <FormLabel htmlFor="transformSql" required>
                Transformation SQL
              </FormLabel>
              <Textarea
                id="transformSql"
                placeholder={`SELECT
  t1.column1,
  t2.column2,
  ...
FROM ${formData.inputDatasets[0] || 'input_table_1'} t1
JOIN ${formData.inputDatasets[1] || 'input_table_2'} t2 ON t1.key = t2.key`}
                value={formData.transformSql}
                onChange={(e) => updateField('transformSql', e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-foreground-muted mt-2">
                <Info className="w-3 h-3 inline mr-1" />
                Reference input datasets by their table names. The SQL will be executed with DuckDB.
              </p>
              <FormError>{errors.transformSql}</FormError>
            </FormField>

            {/* Quick reference for selected datasets */}
            {formData.inputDatasets.length > 0 && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs font-medium text-blue-800 mb-1">Available table names:</p>
                <div className="flex flex-wrap gap-1">
                  {formData.inputDatasets.map(name => (
                    <code key={name} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                      {name}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Dataset Job
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
