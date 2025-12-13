import { useState } from 'react'
import { useAppContext } from '@/lib/context/app-context'
import { WorkflowService } from '@/lib/services/workflow-service'
import { Job } from '@/types/workflow'

export function useJobActions() {
  const { dispatch } = useAppContext()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createJob = async (workflowId: string, jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(`create-${workflowId}`)
      setError(null)

      const newJob = await WorkflowService.createJob(workflowId, jobData)

      dispatch({
        type: 'ADD_JOB',
        payload: {
          workflowId,
          job: newJob
        }
      })

      return newJob

    } catch (err) {
      setError('Failed to create job')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const executeJob = async (jobId: string, sourceFilePath: string) => {
    try {
      setLoading(`execute-${jobId}`)
      setError(null)

      const result = await WorkflowService.executeJob(jobId, sourceFilePath)
      return result

    } catch (err) {
      setError('Failed to execute job')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const uploadFile = async (workflowId: string, jobId: string, file: File, sourceName?: string) => {
    try {
      setLoading(`upload-${jobId}`)
      setError(null)

      const result = await WorkflowService.uploadFile(workflowId, jobId, file, sourceName)
      return result

    } catch (err) {
      setError('Failed to upload file')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const updateJob = async (workflowId: string, jobId: string, updates: Partial<Job>) => {
    try {
      setLoading(`update-${jobId}`)
      setError(null)

      const updatedJob = await WorkflowService.updateJob(workflowId, jobId, updates)

      dispatch({
        type: 'UPDATE_JOB',
        payload: {
          workflowId,
          job: updatedJob
        }
      })

      return updatedJob

    } catch (err) {
      setError('Failed to update job')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const deleteJob = async (workflowId: string, jobId: string) => {
    try {
      setLoading(`delete-${jobId}`)
      setError(null)
      
      await WorkflowService.deleteJob(jobId)
      
      dispatch({
        type: 'DELETE_JOB',
        payload: {
          workflowId,
          jobId
        }
      })
      
    } catch (err) {
      setError('Failed to delete job')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const testConnection = async (sourceConfig: any): Promise<{ success: boolean; message: string }> => {
    try {
      setLoading('test-connection')
      setError(null)
      
      const result = await WorkflowService.testDataSourceConnection(sourceConfig)
      return result
      
    } catch (err) {
      setError('Failed to test connection')
      return { success: false, message: 'Connection test failed' }
    } finally {
      setLoading(null)
    }
  }

  const isLoading = (jobId?: string, action?: string) => {
    if (!jobId && !action) return !!loading
    if (action) return loading === `${action}-${jobId || ''}`
    return loading?.includes(jobId || '') || false
  }

  return {
    createJob,
    updateJob,
    deleteJob,
    executeJob,
    uploadFile,
    testConnection,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}