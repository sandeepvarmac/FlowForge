"use client"

import * as React from "react"
import { Button, Badge, useToast } from "@/components/ui"
import { TargetLayer, DatasetStatus } from "@/types/pipeline"
import {
  Layers,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Database,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Edit,
  Eye
} from "lucide-react"

interface DatasetJob {
  id: string
  pipelineId: string
  name: string
  description?: string
  type: string
  status: string
  targetLayer: TargetLayer
  inputDatasets: string[]
  transformSql: string
  outputTableName: string
  orderIndex: number
  createdAt: number
  updatedAt: number
}

interface DatasetJobCardProps {
  job: DatasetJob
  onRun: (jobId: string) => void
  onEdit?: (job: DatasetJob) => void
  onDelete?: (jobId: string) => void
  onViewDetails?: (job: DatasetJob) => void
  isRunning?: boolean
}

const getLayerColor = (layer: TargetLayer) => {
  switch (layer) {
    case 'bronze':
      return { bg: 'bg-accent-orange/10', text: 'text-accent-orange', border: 'border-accent-orange/30' }
    case 'silver':
      return { bg: 'bg-primary/10', text: 'text-primary', border: 'border-primary/30' }
    case 'gold':
      return { bg: 'bg-secondary/10', text: 'text-secondary', border: 'border-secondary/30' }
    default:
      return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' }
  }
}

const getStatusIcon = (status: string, isRunning?: boolean) => {
  if (isRunning) return <Loader2 className="w-4 h-4 animate-spin text-primary" />
  switch (status) {
    case 'completed':
    case 'ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />
    case 'running':
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}

const getStatusVariant = (status: string): "success" | "destructive" | "default" | "secondary" | "warning" | "outline" => {
  switch (status) {
    case 'completed':
    case 'ready':
      return 'success'
    case 'failed':
      return 'destructive'
    case 'running':
      return 'default'
    default:
      return 'secondary'
  }
}

export function DatasetJobCard({
  job,
  onRun,
  onEdit,
  onDelete,
  onViewDetails,
  isRunning = false
}: DatasetJobCardProps) {
  const { toast } = useToast()
  const [expanded, setExpanded] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  const layerColors = getLayerColor(job.targetLayer)

  const handleRun = async () => {
    try {
      await onRun(job.id)
      toast({
        type: 'success',
        title: 'Dataset Job Started',
        description: `"${job.name}" execution has been triggered`
      })
    } catch (error) {
      toast({
        type: 'error',
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to start Dataset Job'
      })
    }
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-corporate ${layerColors.border}`}>
      {/* Header */}
      <div className="p-4 bg-background">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${layerColors.bg}`}>
              <Layers className={`w-5 h-5 ${layerColors.text}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  Dataset
                </Badge>
                <Badge variant="outline" className={`text-xs ${layerColors.text} ${layerColors.border}`}>
                  {job.targetLayer === 'silver' ? 'Silver Dataset' : 'Gold Dataset'}
                </Badge>
                <Badge variant={getStatusVariant(job.status)} className="text-xs">
                  {getStatusIcon(job.status, isRunning)}
                  <span className="ml-1">{isRunning ? 'Running' : job.status}</span>
                </Badge>
                <h4 className="font-semibold text-foreground truncate">{job.name}</h4>
              </div>
              {job.description && (
                <p className="text-sm text-foreground-muted line-clamp-1">{job.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 ml-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleRun}
              disabled={isRunning}
              className="gap-1"
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run
            </Button>

            <div className="relative">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setMenuOpen(!menuOpen)}
                className="h-8 w-8 p-0"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {menuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-background border rounded-md shadow-lg z-20">
                    {onViewDetails && (
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-background-secondary flex items-center gap-2"
                        onClick={() => {
                          onViewDetails(job)
                          setMenuOpen(false)
                        }}
                      >
                        <Eye className="w-4 h-4" />
                        View Details
                      </button>
                    )}
                    {onEdit && (
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-background-secondary flex items-center gap-2"
                        onClick={() => {
                          onEdit(job)
                          setMenuOpen(false)
                        }}
                      >
                        <Edit className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        className="w-full px-3 py-2 text-sm text-left hover:bg-background-secondary text-red-600 flex items-center gap-2"
                        onClick={() => {
                          onDelete(job.id)
                          setMenuOpen(false)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick Info */}
        <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted">
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>{job.inputDatasets.length} input{job.inputDatasets.length !== 1 ? 's' : ''}</span>
          </div>
          <div>
            <span className="font-medium">Output:</span> {job.outputTableName}
          </div>
        </div>

        {/* Expand Toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show details
            </>
          )}
        </button>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="border-t p-4 bg-background-secondary space-y-4">
          {/* Input Datasets */}
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-2">Input Datasets</h5>
            <div className="flex flex-wrap gap-1">
              {job.inputDatasets.map(dataset => (
                <Badge key={dataset} variant="outline" className="text-xs">
                  {dataset}
                </Badge>
              ))}
            </div>
          </div>

          {/* SQL Transform Preview */}
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-2">SQL Transform</h5>
            <pre className="text-xs bg-background p-3 rounded border overflow-x-auto max-h-32 overflow-y-auto font-mono">
              {job.transformSql}
            </pre>
          </div>

          {/* Output */}
          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="text-foreground-muted">Output Table:</span>{' '}
              <span className="font-medium">{job.outputTableName}</span>
            </div>
            <div>
              <span className="text-foreground-muted">Target:</span>{' '}
              <span className={`font-medium ${layerColors.text}`}>
                {job.targetLayer.charAt(0).toUpperCase() + job.targetLayer.slice(1)} Layer
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
