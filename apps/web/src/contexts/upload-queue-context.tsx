'use client'

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { WorkflowService } from '@/lib/services/workflow-service'

export interface UploadTask {
  id: string
  workflowId: string
  jobId: string
  jobName: string
  file: File
  status: 'queued' | 'uploading' | 'completed' | 'failed'
  progress: number
  error?: string
  startedAt?: Date
  completedAt?: Date
}

interface UploadQueueContextType {
  tasks: UploadTask[]
  queueUpload: (workflowId: string, jobId: string, jobName: string, file: File) => void
  removeTask: (taskId: string) => void
  retryTask: (taskId: string) => void
  clearCompleted: () => void
}

const UploadQueueContext = createContext<UploadQueueContextType | undefined>(undefined)

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<UploadTask[]>([])
  const processingRef = useRef(false)
  const tasksRef = useRef<UploadTask[]>([])

  const applyTaskUpdate = useCallback((taskId: string, updates: Partial<UploadTask>) => {
    setTasks(prev => {
      const next = prev.map(task => (task.id === taskId ? { ...task, ...updates } : task))
      tasksRef.current = next
      return next
    })
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current) return
    processingRef.current = true

    try {
      while (true) {
        const nextTask = tasksRef.current.find(task => task.status === 'queued')
        if (!nextTask) break

        applyTaskUpdate(nextTask.id, {
          status: 'uploading',
          startedAt: new Date(),
          error: undefined
        })

        try {
          console.log('?? Starting background upload:', nextTask.file.name)

          await WorkflowService.uploadFile(
            nextTask.workflowId,
            nextTask.jobId,
            nextTask.file
          )

          console.log('? Background upload completed:', nextTask.file.name)

          applyTaskUpdate(nextTask.id, {
            status: 'completed',
            progress: 100,
            completedAt: new Date()
          })
        } catch (error) {
          console.error('? Background upload failed:', error)

          applyTaskUpdate(nextTask.id, {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Upload failed',
            completedAt: new Date()
          })
        }
      }
    } finally {
      processingRef.current = false
    }
  }, [applyTaskUpdate])

  useEffect(() => {
    tasksRef.current = tasks

    if (!processingRef.current && tasks.some(task => task.status === 'queued')) {
      void processQueue()
    }
  }, [tasks, processQueue])

  const queueUpload = useCallback((
    workflowId: string,
    jobId: string,
    jobName: string,
    file: File
  ) => {
    const task: UploadTask = {
      id: `${jobId}-${Date.now()}`,
      workflowId,
      jobId,
      jobName,
      file,
      status: 'queued',
      progress: 0
    }

    setTasks(prev => {
      const next = [...prev, task]
      tasksRef.current = next
      return next
    })
  }, [])

  const removeTask = useCallback((taskId: string) => {
    setTasks(prev => {
      const next = prev.filter(task => task.id !== taskId)
      tasksRef.current = next
      return next
    })
  }, [])

  const retryTask = useCallback((taskId: string) => {
    applyTaskUpdate(taskId, {
      status: 'queued',
      error: undefined,
      progress: 0,
      startedAt: undefined,
      completedAt: undefined
    })
  }, [applyTaskUpdate])

  const clearCompleted = useCallback(() => {
    setTasks(prev => {
      const next = prev.filter(task => task.status !== 'completed')
      tasksRef.current = next
      return next
    })
  }, [])

  return (
    <UploadQueueContext.Provider value={{
      tasks,
      queueUpload,
      removeTask,
      retryTask,
      clearCompleted
    }}>
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  const context = useContext(UploadQueueContext)
  if (!context) {
    throw new Error('useUploadQueue must be used within UploadQueueProvider')
  }
  return context
}
