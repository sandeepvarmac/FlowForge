import { useState } from 'react'
import { useAppContext } from '@/lib/context/app-context'
import { WorkflowService } from '@/lib/services/workflow-service'
import { WorkflowStatus } from '@/types'

export function useWorkflowActions() {
  const { state, dispatch } = useAppContext()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runWorkflow = async (workflowId: string) => {
    try {
      setLoading(`run-${workflowId}`)
      setError(null)
      
      // Update status to running
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          ...state.workflows.find(w => w.id === workflowId)!,
          status: 'running' as WorkflowStatus,
          lastRun: new Date(),
          updatedAt: new Date()
        }
      })

      await WorkflowService.runWorkflow(workflowId)
      
      // Simulate completion after a delay
      setTimeout(() => {
        dispatch({
          type: 'UPDATE_WORKFLOW',
          payload: {
            ...state.workflows.find(w => w.id === workflowId)!,
            status: 'completed' as WorkflowStatus,
            updatedAt: new Date()
          }
        })
      }, 3000)
      
    } catch (err) {
      setError('Failed to run workflow')
      // Revert status on error
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          ...state.workflows.find(w => w.id === workflowId)!,
          status: 'failed' as WorkflowStatus,
          updatedAt: new Date()
        }
      })
    } finally {
      setLoading(null)
    }
  }

  const pauseWorkflow = async (workflowId: string) => {
    try {
      setLoading(`pause-${workflowId}`)
      setError(null)
      
      await WorkflowService.pauseWorkflow(workflowId)
      
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          ...state.workflows.find(w => w.id === workflowId)!,
          status: 'paused' as WorkflowStatus,
          updatedAt: new Date()
        }
      })
      
    } catch (err) {
      setError('Failed to pause workflow')
    } finally {
      setLoading(null)
    }
  }

  const resumeWorkflow = async (workflowId: string) => {
    try {
      setLoading(`resume-${workflowId}`)
      setError(null)
      
      await WorkflowService.resumeWorkflow(workflowId)
      
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          ...state.workflows.find(w => w.id === workflowId)!,
          status: 'scheduled' as WorkflowStatus,
          updatedAt: new Date()
        }
      })
      
    } catch (err) {
      setError('Failed to resume workflow')
    } finally {
      setLoading(null)
    }
  }

  const deleteWorkflow = async (workflowId: string) => {
    try {
      setLoading(`delete-${workflowId}`)
      setError(null)
      
      await WorkflowService.deleteWorkflow(workflowId)
      
      dispatch({
        type: 'DELETE_WORKFLOW',
        payload: workflowId
      })
      
    } catch (err) {
      setError('Failed to delete workflow')
    } finally {
      setLoading(null)
    }
  }

  const updateWorkflowStatus = async (workflowId: string, status: WorkflowStatus) => {
    try {
      setLoading(`update-${workflowId}`)
      setError(null)
      
      await WorkflowService.updateWorkflowStatus(workflowId, status)
      
      dispatch({
        type: 'UPDATE_WORKFLOW',
        payload: {
          ...state.workflows.find(w => w.id === workflowId)!,
          status,
          updatedAt: new Date()
        }
      })
      
    } catch (err) {
      setError('Failed to update workflow status')
    } finally {
      setLoading(null)
    }
  }

  const createWorkflow = async (data: any) => {
    try {
      setLoading('create')
      setError(null)

      const newWorkflow = await WorkflowService.createWorkflow(data)

      dispatch({
        type: 'ADD_WORKFLOW',
        payload: newWorkflow
      })

      return newWorkflow
    } catch (err) {
      setError('Failed to create workflow')
      throw err
    } finally {
      setLoading(null)
    }
  }

  const isLoading = (workflowId: string, action?: string) => {
    if (!action) return loading?.includes(workflowId) || false
    return loading === `${action}-${workflowId}`
  }

  return {
    createWorkflow,
    runWorkflow,
    pauseWorkflow,
    resumeWorkflow,
    deleteWorkflow,
    updateWorkflowStatus,
    isLoading,
    error,
    clearError: () => setError(null)
  }
}