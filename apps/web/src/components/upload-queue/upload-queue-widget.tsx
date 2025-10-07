'use client'

import { useUploadQueue } from '@/contexts/upload-queue-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X, Upload, CheckCircle2, AlertCircle, RotateCw, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export function UploadQueueWidget() {
  const { tasks, removeTask, retryTask, clearCompleted } = useUploadQueue()

  // Don't show widget if no tasks
  if (tasks.length === 0) return null

  const activeTasks = tasks.filter(t => t.status === 'queued' || t.status === 'uploading')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  const failedTasks = tasks.filter(t => t.status === 'failed')

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96">
      <Card className="bg-white dark:bg-gray-800 shadow-lg border">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm">File Uploads</h3>
            {activeTasks.length > 0 && (
              <span className="text-xs text-gray-500">
                ({activeTasks.length} active)
              </span>
            )}
          </div>
          {completedTasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompleted}
              className="h-7 text-xs"
            >
              Clear completed
            </Button>
          )}
        </div>

        {/* Task List */}
        <div className="max-h-96 overflow-y-auto">
          {tasks.map(task => (
            <div
              key={task.id}
              className="p-3 border-b last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-start gap-3">
                {/* Status Icon */}
                <div className="mt-0.5">
                  {task.status === 'uploading' && (
                    <Upload className="h-4 w-4 text-blue-600 animate-pulse" />
                  )}
                  {task.status === 'queued' && (
                    <Upload className="h-4 w-4 text-gray-400" />
                  )}
                  {task.status === 'completed' && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  {task.status === 'failed' && (
                    <AlertCircle className="h-4 w-4 text-red-600" />
                  )}
                </div>

                {/* Task Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {task.file.name}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {task.jobName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTask(task.id)}
                      className="h-6 w-6 p-0 flex-shrink-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* Status Text */}
                  <div className="mt-1">
                    {task.status === 'uploading' && (
                      <p className="text-xs text-blue-600">
                        Uploading...
                      </p>
                    )}
                    {task.status === 'queued' && (
                      <p className="text-xs text-gray-500">
                        Waiting in queue...
                      </p>
                    )}
                    {task.status === 'completed' && task.completedAt && (
                      <p className="text-xs text-green-600">
                        Completed {formatDistanceToNow(task.completedAt, { addSuffix: true })}
                      </p>
                    )}
                    {task.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-red-600">
                          {task.error || 'Upload failed'}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryTask(task.id)}
                          className="h-6 px-2 text-xs"
                        >
                          <RotateCw className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* File Size */}
                  <p className="text-xs text-gray-400 mt-0.5">
                    {(task.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Footer */}
        {(completedTasks.length > 0 || failedTasks.length > 0) && (
          <div className="p-2 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              {completedTasks.length > 0 && (
                <span className="text-green-600">
                  ✓ {completedTasks.length} completed
                </span>
              )}
              {failedTasks.length > 0 && (
                <span className="text-red-600">
                  ✗ {failedTasks.length} failed
                </span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
