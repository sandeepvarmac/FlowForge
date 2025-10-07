'use client'

import * as React from 'react'
import { Button } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DeleteConfirmationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  itemName: string
  itemType: 'workflow' | 'job'
  isDeleting?: boolean
}

export function DeleteConfirmationModal({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  itemType,
  isDeleting = false
}: DeleteConfirmationModalProps) {
  const [confirmText, setConfirmText] = React.useState('')
  const [error, setError] = React.useState('')

  const isConfirmValid = confirmText.toLowerCase() === 'delete'

  React.useEffect(() => {
    if (!open) {
      setConfirmText('')
      setError('')
    }
  }, [open])

  const handleConfirm = async () => {
    if (!isConfirmValid) {
      setError('Please type "delete" to confirm')
      return
    }

    try {
      await onConfirm()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold text-foreground mb-2">
                {title}
              </DialogTitle>
              <DialogDescription className="text-sm text-foreground-muted">
                {description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Item Details Card */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-4 h-4 text-red-700" />
              <span className="text-sm font-semibold text-red-900">
                {itemType === 'workflow' ? 'Workflow' : 'Job'} to be deleted:
              </span>
            </div>
            <p className="text-sm font-mono text-red-800 bg-red-100 px-3 py-2 rounded border border-red-200">
              {itemName}
            </p>
          </div>

          {/* Warning Message */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-sm text-yellow-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                <strong>Warning:</strong> This action cannot be undone.
                {itemType === 'workflow' && ' All associated jobs and execution history will also be permanently deleted.'}
                {itemType === 'job' && ' All execution history for this job will also be permanently deleted.'}
              </span>
            </p>
          </div>

          {/* Confirmation Input */}
          <div className="space-y-2">
            <label htmlFor="confirm-delete" className="text-sm font-medium text-foreground">
              Type <span className="font-mono font-bold text-red-600">delete</span> to confirm:
            </label>
            <Input
              id="confirm-delete"
              type="text"
              value={confirmText}
              onChange={(e) => {
                setConfirmText(e.target.value)
                setError('')
              }}
              placeholder="Type 'delete' here"
              className={error ? 'border-red-500 focus:ring-red-500' : ''}
              autoComplete="off"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {error}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!isConfirmValid || isDeleting}
            className="gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete {itemType === 'workflow' ? 'Workflow' : 'Job'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
