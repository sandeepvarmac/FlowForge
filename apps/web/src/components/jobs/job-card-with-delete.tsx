'use client'

import * as React from 'react'
import { Button, Badge, useToast } from '@/components/ui'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { useJobActions } from '@/hooks'
import { Job } from '@/types/workflow'
import { FileText, Database, Cloud, Play, Loader2, CheckCircle, ArrowRight, Trash2 } from 'lucide-react'

interface JobCardWithDeleteProps {
  job: Job
  workflowId: string
  onRunJob: (jobId: string) => void
  isRunning: boolean
}

export function JobCardWithDelete({ job, workflowId, onRunJob, isRunning }: JobCardWithDeleteProps) {
  const { deleteJob } = useJobActions()
  const { toast } = useToast()
  const [deleteModalOpen, setDeleteModalOpen] = React.useState(false)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setDeleteModalOpen(true)
  }

  const handleConfirmDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteJob(workflowId, job.id)
      toast({
        type: 'success',
        title: 'Job Deleted',
        description: `"${job.name}" has been permanently deleted along with its execution history.`
      })
      setDeleteModalOpen(false)
    } catch (error) {
      toast({
        type: 'error',
        title: 'Delete Failed',
        description: error instanceof Error ? error.message : 'Failed to delete job'
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="border border-border rounded-lg p-4 hover:bg-background-secondary transition-colors group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center mt-1">
              {job.type === 'file-based' && <FileText className="w-4 h-4 text-primary" />}
              {job.type === 'database' && <Database className="w-4 h-4 text-primary" />}
              {job.type === 'api' && <Cloud className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-foreground">{job.name}</h4>
                <Badge variant={
                  job.status === 'completed' ? 'success' :
                  job.status === 'failed' ? 'destructive' :
                  job.status === 'running' ? 'default' :
                  'secondary'
                }>
                  {job.status}
                </Badge>
              </div>
              <p className="text-sm text-foreground-muted mb-2">{job.description}</p>

              {/* Source Info */}
              <div className="text-xs text-foreground-muted">
                <span className="font-medium">Source:</span> {job.sourceConfig.name} ({job.sourceConfig.type})
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-right text-xs text-foreground-muted">
              <div>Order: {job.order}</div>
              {job.lastRun && (
                <div className="mt-1">
                  Last run: {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }).format(job.lastRun)}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRunJob(job.id)}
                disabled={isRunning}
                className="text-xs"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Running
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 mr-1" />
                    Run
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleDeleteClick}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete Job"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Pipeline Layers */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
            <span className="text-foreground-muted">Bronze</span>
            {job.destinationConfig.bronzeConfig.enabled && (
              <CheckCircle className="w-3 h-3 text-green-600" />
            )}
          </div>

          {job.destinationConfig.silverConfig?.enabled && (
            <>
              <ArrowRight className="w-3 h-3 text-foreground-muted" />
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-foreground-muted">Silver</span>
                <CheckCircle className="w-3 h-3 text-green-600" />
              </div>
            </>
          )}

          {job.destinationConfig.goldConfig?.enabled && (
            <>
              <ArrowRight className="w-3 h-3 text-foreground-muted" />
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span className="text-foreground-muted">Gold</span>
                <CheckCircle className="w-3 h-3 text-green-600" />
              </div>
            </>
          )}
        </div>

        {/* Validation & Transformation Info */}
        {(job.transformationConfig || job.validationConfig) && (
          <div className="mt-3 pt-3 border-t border-border text-xs">
            <div className="flex gap-4">
              {job.transformationConfig && (
                <div className="text-foreground-muted">
                  <span className="font-medium">Transformations:</span> {job.transformationConfig.columnMappings.length} mappings
                  {job.transformationConfig.lookups && job.transformationConfig.lookups.length > 0 && (
                    <span>, {job.transformationConfig.lookups.length} lookups</span>
                  )}
                </div>
              )}
              {job.validationConfig && (
                <div className="text-foreground-muted">
                  <span className="font-medium">Validations:</span>
                  {job.validationConfig.dataQualityRules?.length || 0} DQ rules,
                  {job.validationConfig.reconciliationRules?.length || 0} reconciliation rules
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleConfirmDelete}
        title="Delete Job"
        description="Are you sure you want to delete this job? This action cannot be undone and will permanently delete all execution history for this job."
        itemName={job.name}
        itemType="job"
        isDeleting={isDeleting}
      />
    </>
  )
}
