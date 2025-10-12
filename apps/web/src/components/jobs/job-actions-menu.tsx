'use client'

import * as React from 'react'
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui'
import {
  MoreVertical,
  Eye,
  Edit,
  Play,
  Copy,
  Trash2
} from 'lucide-react'

export interface JobActionsMenuProps {
  jobId: string
  jobName: string
  onView?: () => void
  onEdit?: () => void
  onRun?: () => void
  onClone?: () => void
  onDelete?: () => void
  isRunning?: boolean
  disabled?: boolean
}

export function JobActionsMenu({
  jobId,
  jobName,
  onView,
  onEdit,
  onRun,
  onClone,
  onDelete,
  isRunning = false,
  disabled = false
}: JobActionsMenuProps) {
  return (
    <DropdownMenu
      trigger={
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="h-8 w-8 p-0"
        >
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">Open job actions menu</span>
        </Button>
      }
    >
      {onView && (
        <DropdownMenuItem onClick={onView}>
          <Eye className="w-4 h-4" />
          <span>View Details</span>
        </DropdownMenuItem>
      )}
      {onEdit && (
        <DropdownMenuItem onClick={onEdit}>
          <Edit className="w-4 h-4" />
          <span>Edit Job</span>
        </DropdownMenuItem>
      )}
      {onRun && (
        <DropdownMenuItem onClick={onRun}>
          <Play className="w-4 h-4" />
          <span>{isRunning ? 'Running...' : 'Run Now'}</span>
        </DropdownMenuItem>
      )}
      {onClone && (
        <DropdownMenuItem onClick={onClone}>
          <Copy className="w-4 h-4" />
          <span>Clone Job</span>
        </DropdownMenuItem>
      )}
      {(onView || onEdit || onRun || onClone) && onDelete && (
        <DropdownMenuSeparator />
      )}
      {onDelete && (
        <DropdownMenuItem
          onClick={onDelete}
          destructive
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete Job</span>
        </DropdownMenuItem>
      )}
    </DropdownMenu>
  )
}
