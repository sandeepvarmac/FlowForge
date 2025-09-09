'use client'

import React, { createContext, useContext, useReducer, ReactNode } from 'react'
import { Workflow, DashboardMetrics } from '@/types'

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