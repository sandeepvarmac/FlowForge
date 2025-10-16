"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Button } from '@/components/ui'
import { Clock, GitBranch, Zap, Sparkles } from 'lucide-react'

interface AddTriggerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  onTriggerCreated?: () => void
}

export function AddTriggerModal({ open, onOpenChange, workflowId, onTriggerCreated }: AddTriggerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Add Trigger
          </DialogTitle>
          <DialogDescription>
            Enhanced trigger configuration interface
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-purple-600" />
              </div>
              <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-yellow-600" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-foreground">Trigger Configuration UI is Being Refined</h3>
              <p className="text-sm text-foreground-muted">
                For now, triggers can be configured during workflow creation.
              </p>
            </div>

            <div className="bg-primary-50/50 border border-primary-200 rounded-lg p-4 text-left space-y-2">
              <h4 className="text-sm font-medium text-foreground">Coming Soon:</h4>
              <ul className="text-sm text-foreground-muted space-y-1">
                <li>• Full trigger configuration wizard</li>
                <li>• Visual cron expression builder</li>
                <li>• Real-time dependency validation</li>
                <li>• Multi-trigger management</li>
              </ul>
            </div>

            <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 text-left">
              <p className="text-xs text-blue-800">
                <strong>Tip:</strong> You can add triggers when creating a workflow by selecting a trigger type in the "Initial Trigger (Optional)" section.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <Button onClick={() => onOpenChange(false)}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
