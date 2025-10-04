'use client'

import React, { createContext, useContext, useReducer, ReactNode, useEffect } from 'react'
import { DashboardMetrics } from '@/types'
import { Workflow, Job } from '@/types/workflow'
import { WorkflowService } from '@/lib/services/workflow-service'

interface AppState {
  workflows: Workflow[]
  dashboardMetrics: DashboardMetrics | null
  loading: boolean
  error: string | null
}

type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_WORKFLOWS'; payload: Workflow[] }
  | { type: 'ADD_WORKFLOW'; payload: Workflow }
  | { type: 'UPDATE_WORKFLOW'; payload: Workflow }
  | { type: 'DELETE_WORKFLOW'; payload: string }
  | { type: 'ADD_JOB'; payload: { workflowId: string; job: Job } }
  | { type: 'UPDATE_JOB'; payload: { workflowId: string; job: Job } }
  | { type: 'DELETE_JOB'; payload: { workflowId: string; jobId: string } }
  | { type: 'SET_DASHBOARD_METRICS'; payload: DashboardMetrics }

const initialState: AppState = {
  workflows: [],
  dashboardMetrics: null,
  loading: false,
  error: null
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }
    case 'SET_WORKFLOWS':
      return { ...state, workflows: action.payload, loading: false }
    case 'ADD_WORKFLOW':
      return { ...state, workflows: [...state.workflows, action.payload] }
    case 'UPDATE_WORKFLOW':
      return {
        ...state,
        workflows: state.workflows.map(w => 
          w.id === action.payload.id ? action.payload : w
        )
      }
    case 'DELETE_WORKFLOW':
      return {
        ...state,
        workflows: state.workflows.filter(w => w.id !== action.payload)
      }
    case 'ADD_JOB':
      return {
        ...state,
        workflows: state.workflows.map(w => 
          w.id === action.payload.workflowId 
            ? { ...w, jobs: [...w.jobs, action.payload.job] }
            : w
        )
      }
    case 'UPDATE_JOB':
      return {
        ...state,
        workflows: state.workflows.map(w => 
          w.id === action.payload.workflowId 
            ? { 
                ...w, 
                jobs: w.jobs.map(j => 
                  j.id === action.payload.job.id ? action.payload.job : j
                )
              }
            : w
        )
      }
    case 'DELETE_JOB':
      return {
        ...state,
        workflows: state.workflows.map(w => 
          w.id === action.payload.workflowId 
            ? { ...w, jobs: w.jobs.filter(j => j.id !== action.payload.jobId) }
            : w
        )
      }
    case 'SET_DASHBOARD_METRICS':
      return { ...state, dashboardMetrics: action.payload }
    default:
      return state
  }
}

const AppContext = createContext<{
  state: AppState
  dispatch: React.Dispatch<AppAction>
} | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    // Load workflows from API
    const loadWorkflows = async () => {
      try {
        dispatch({ type: 'SET_LOADING', payload: true })
        const workflows = await WorkflowService.getWorkflows()
        dispatch({ type: 'SET_WORKFLOWS', payload: workflows })
      } catch (error) {
        console.error('Failed to load workflows:', error)
        dispatch({ type: 'SET_ERROR', payload: 'Failed to load workflows' })
      }
    }

    loadWorkflows()
  }, [])

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}