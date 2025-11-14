"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"

export type SchemaLoadingStep = 'connecting' | 'analyzing' | 'detecting' | 'profiling' | 'complete'

interface SchemaLoadingProgressProps {
  step: SchemaLoadingStep
  progressPercent: number
  sourceType: 'file' | 'database'
}

export function SchemaLoadingProgress({ step, progressPercent, sourceType }: SchemaLoadingProgressProps) {
  const getStepLabel = () => {
    if (sourceType === 'file') {
      switch (step) {
        case 'connecting': return 'Checking file...'
        case 'analyzing': return 'Analyzing your data...'
        case 'detecting': return 'Finding column names...'
        case 'profiling': return 'Building data structure...'
        default: return 'Getting started...'
      }
    } else {
      // Database
      switch (step) {
        case 'connecting': return 'Connecting to database...'
        case 'analyzing': return 'Analyzing table structure...'
        case 'detecting': return 'Detecting data types...'
        case 'profiling': return 'Profiling data quality...'
        default: return 'Getting started...'
      }
    }
  }

  return (
    <div className="space-y-5 max-w-md mx-auto">
      {/* Icon with dynamic animation */}
      <div className="relative w-16 h-16 mx-auto">
        {step === 'analyzing' ? (
          <Sparkles className="w-16 h-16 text-purple-500 animate-pulse mx-auto" />
        ) : (
          <div className="animate-spin w-16 h-16 border-4 border-primary border-t-transparent rounded-full"></div>
        )}
      </div>

      {/* Dynamic Status Label */}
      <div className="space-y-2">
        <p className="text-lg font-semibold text-foreground">
          {step === 'analyzing' ? (
            <span className="flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5" />
              {getStepLabel()}
            </span>
          ) : (
            getStepLabel()
          )}
        </p>
        <p className="text-sm text-foreground-muted">
          Usually takes 10-15 seconds
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 h-full transition-all duration-700 ease-out"
          style={{
            width: `${progressPercent || 10}%`
          }}
        />
      </div>

      {/* Progress Percentage */}
      {progressPercent !== undefined && (
        <p className="text-xs text-foreground-muted font-medium">
          {progressPercent}% complete
        </p>
      )}
    </div>
  )
}
