"use client"

import * as React from "react"
import { Button, Badge, useToast } from "@/components/ui"
import {
  Download,
  Play,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Database,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  Cloud,
  Upload,
  HardDrive
} from "lucide-react"
import { formatDistanceToNow } from 'date-fns'

interface IngestJobRun {
  id: string
  status: 'pending' | 'running' | 'succeeded' | 'failed' | 'cancelled'
  rowCount?: number
  startedAt?: number
  finishedAt?: number
  durationMs?: number
  outputKey?: string
  errorMessage?: string
}

interface IngestJob {
  id: string
  pipelineId: string
  name: string
  description?: string
  sourceType: 'upload' | 's3' | 'local'
  sourcePath?: string
  fileFormat: 'csv' | 'parquet' | 'json'
  options?: {
    delimiter?: string
    header?: boolean
    dateColumns?: string[]
  }
  targetTable: string
  environment: string
  status: string
  latestRun?: IngestJobRun | null
  createdAt: number
  updatedAt: number
}

interface IngestJobCardProps {
  job: IngestJob
  onRun: (jobId: string) => void
  onEdit?: (job: IngestJob) => void
  onDelete?: (jobId: string) => void
  onViewDetails?: (job: IngestJob) => void
  isRunning?: boolean
}

const getSourceTypeIcon = (sourceType: string) => {
  switch (sourceType) {
    case 'upload':
      return <Upload className="w-4 h-4" />
    case 's3':
      return <Cloud className="w-4 h-4" />
    case 'local':
      return <HardDrive className="w-4 h-4" />
    default:
      return <FileText className="w-4 h-4" />
  }
}

const getFormatBadgeColor = (format: string) => {
  switch (format) {
    case 'csv':
      return 'bg-green-100 text-green-700 border-green-200'
    case 'parquet':
      return 'bg-blue-100 text-blue-700 border-blue-200'
    case 'json':
      return 'bg-purple-100 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getStatusIcon = (status: string, isRunning?: boolean) => {
  if (isRunning) return <Loader2 className="w-4 h-4 animate-spin text-primary" />
  switch (status) {
    case 'succeeded':
    case 'completed':
    case 'ready':
      return <CheckCircle className="w-4 h-4 text-green-500" />
    case 'failed':
      return <XCircle className="w-4 h-4 text-red-500" />
    case 'running':
    case 'pending':
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />
    default:
      return <Clock className="w-4 h-4 text-gray-400" />
  }
}

const getStatusVariant = (status: string): "success" | "destructive" | "default" | "secondary" | "warning" | "outline" => {
  switch (status) {
    case 'succeeded':
    case 'completed':
    case 'ready':
      return 'success'
    case 'failed':
      return 'destructive'
    case 'running':
    case 'pending':
      return 'default'
    default:
      return 'secondary'
  }
}

const formatDuration = (durationMs?: number) => {
  if (!durationMs || durationMs <= 0) return '-'
  const totalSeconds = Math.floor(durationMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

export function IngestJobCard({
  job,
  onRun,
  onEdit,
  onDelete,
  onViewDetails,
  isRunning = false
}: IngestJobCardProps) {
  const { toast } = useToast()
  const [expanded, setExpanded] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)

  const handleRun = async () => {
    try {
      await onRun(job.id)
      toast({
        type: 'success',
        title: 'Ingest Job Started',
        description: `"${job.name}" is now ingesting data to Bronze layer`
      })
    } catch (error) {
      toast({
        type: 'error',
        title: 'Execution Failed',
        description: error instanceof Error ? error.message : 'Failed to start Ingest Job'
      })
    }
  }

  const displayStatus = isRunning ? 'running' : (job.latestRun?.status || job.status)

  return (
    <div className="border rounded-lg overflow-hidden transition-all duration-200 hover:shadow-corporate border-accent-orange/30">
      {/* Header */}
      <div className="p-4 bg-background">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-orange/10">
              <Download className="w-5 h-5 text-accent-orange" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="text-xs text-accent-orange border-accent-orange/30">
                  Ingest
                </Badge>
                <Badge variant="outline" className="text-xs text-accent-orange border-accent-orange/30">
                  Landing → Bronze
                </Badge>
                <Badge variant={getStatusVariant(displayStatus)} className="text-xs">
                  {getStatusIcon(displayStatus, isRunning)}
                  <span className="ml-1">{isRunning ? 'Running' : displayStatus}</span>
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
              disabled={isRunning || displayStatus === 'running' || displayStatus === 'pending'}
              className="gap-1"
            >
              {isRunning || displayStatus === 'running' ? (
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
        <div className="mt-3 flex items-center gap-4 text-xs text-foreground-muted flex-wrap">
          <div className="flex items-center gap-1">
            {getSourceTypeIcon(job.sourceType)}
            <span className="capitalize">{job.sourceType}</span>
          </div>
          <div className={`px-2 py-0.5 rounded border ${getFormatBadgeColor(job.fileFormat)}`}>
            {job.fileFormat.toUpperCase()}
          </div>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3" />
            <span>{job.targetTable}</span>
          </div>
          <div>
            <span className="text-foreground-muted">Env:</span>{' '}
            <span className="font-medium">{job.environment}</span>
          </div>
        </div>

        {/* Latest Run Info */}
        {job.latestRun && (
          <div className="mt-2 flex items-center gap-4 text-xs text-foreground-muted">
            <span>Last run:</span>
            {job.latestRun.startedAt && (
              <span>{formatDistanceToNow(new Date(job.latestRun.startedAt), { addSuffix: true })}</span>
            )}
            {job.latestRun.rowCount !== undefined && job.latestRun.rowCount > 0 && (
              <span className="font-medium text-foreground">
                {job.latestRun.rowCount.toLocaleString()} rows
              </span>
            )}
            {job.latestRun.durationMs && (
              <span>{formatDuration(job.latestRun.durationMs)}</span>
            )}
          </div>
        )}

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
          {/* Source Info */}
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-2">Source Configuration</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-foreground-muted">Source Type:</span>{' '}
                <span className="font-medium capitalize">{job.sourceType}</span>
              </div>
              {job.sourcePath && (
                <div className="col-span-2">
                  <span className="text-foreground-muted">Path:</span>{' '}
                  <span className="font-mono text-xs break-all">{job.sourcePath}</span>
                </div>
              )}
              <div>
                <span className="text-foreground-muted">Format:</span>{' '}
                <span className="font-medium uppercase">{job.fileFormat}</span>
              </div>
              {job.options?.delimiter && (
                <div>
                  <span className="text-foreground-muted">Delimiter:</span>{' '}
                  <span className="font-mono">"{job.options.delimiter}"</span>
                </div>
              )}
              {job.options?.header !== undefined && (
                <div>
                  <span className="text-foreground-muted">Has Header:</span>{' '}
                  <span>{job.options.header ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Target Info */}
          <div>
            <h5 className="text-xs font-semibold text-foreground mb-2">Target Configuration</h5>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-foreground-muted">Table:</span>{' '}
                <span className="font-medium">{job.targetTable}</span>
              </div>
              <div>
                <span className="text-foreground-muted">Layer:</span>{' '}
                <span className="font-medium text-accent-orange">Bronze</span>
              </div>
              <div>
                <span className="text-foreground-muted">Environment:</span>{' '}
                <span className="font-medium">{job.environment}</span>
              </div>
            </div>
          </div>

          {/* Latest Run Details */}
          {job.latestRun && (
            <div>
              <h5 className="text-xs font-semibold text-foreground mb-2">Latest Run</h5>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-foreground-muted">Status:</span>{' '}
                  <Badge variant={getStatusVariant(job.latestRun.status)} className="text-xs ml-1">
                    {job.latestRun.status}
                  </Badge>
                </div>
                {job.latestRun.rowCount !== undefined && (
                  <div>
                    <span className="text-foreground-muted">Rows:</span>{' '}
                    <span className="font-medium">{job.latestRun.rowCount.toLocaleString()}</span>
                  </div>
                )}
                {job.latestRun.durationMs && (
                  <div>
                    <span className="text-foreground-muted">Duration:</span>{' '}
                    <span>{formatDuration(job.latestRun.durationMs)}</span>
                  </div>
                )}
                {job.latestRun.outputKey && (
                  <div className="col-span-2">
                    <span className="text-foreground-muted">Output:</span>{' '}
                    <span className="font-mono text-xs break-all">{job.latestRun.outputKey}</span>
                  </div>
                )}
                {job.latestRun.errorMessage && (
                  <div className="col-span-2 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                    <span className="font-medium">Error:</span> {job.latestRun.errorMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
