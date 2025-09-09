import { useState } from 'react'
import { useAppContext } from '@/lib/context/app-context'
import { WorkflowService } from '@/lib/services/workflow-service'
import { Job } from '@/types/workflow'

export function useJobActions() {
  const { dispatch } = useAppContext()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const createJob = async (jobData: Omit<Job, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setLoading(`create-${jobData.workflowId}`)
      setError(null)
      
      const newJob = await WorkflowService.createJob(jobData)
      
      dispatch({
        type: 'ADD_JOB',
        payload: {
          workflowId: jobData.workflowId,
          job: newJob
        }
      })
      
    } catch (err) {
      setError('Failed to create job')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const updateJob = async (workflowId: string, jobId: string, updates: Partial<Job>) => {
    try {
      setLoading(`update-${jobId}`)
      setError(null)
      
      const updatedJob = await WorkflowService.updateJob(jobId, updates)
      
      dispatch({
        type: 'UPDATE_JOB',
        payload: {
          workflowId,
          job: updatedJob
        }
      })
      
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
    testConnection,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}