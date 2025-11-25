'use client'

import React from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle,
  Database,
  Layers,
  TrendingUp,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressEvent {
  type: 'progress'
  stage: string
  message: string
}

interface FullAnalysisResult {
  success: boolean
  bronze: any
  silver: any
  gold: any
  analysisSummary: {
    status: 'started' | 'completed' | 'partial' | 'failed'
    progress: number
    events: any[]
    error?: string
  }
  providerUsed?: 'anthropic' | 'openai' | 'unknown'
  progressEvents?: ProgressEvent[]
}

interface FullAnalysisModalProps {
  isOpen: boolean
  isAnalyzing: boolean
  result: FullAnalysisResult | null
  error: string | null
  onAccept: () => void
  onDiscard: () => void
  onClose: () => void
}

export function FullAnalysisModal({
  isOpen,
  isAnalyzing,
  result,
  error,
  onAccept,
  onDiscard,
  onClose
}: FullAnalysisModalProps) {
  const [currentStage, setCurrentStage] = React.useState<string>('sampling')
  const [progressMessages, setProgressMessages] = React.useState<string[]>([])
  const [progress, setProgress] = React.useState(0)

  // Update progress based on result
  React.useEffect(() => {
    if (result?.progressEvents) {
      result.progressEvents.forEach((event) => {
        setCurrentStage(event.stage)
        setProgressMessages((prev) => [...prev, event.message])
      })
    }

    if (result?.analysisSummary?.progress) {
      setProgress(result.analysisSummary.progress)
    }
  }, [result])

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen && isAnalyzing) {
      setCurrentStage('sampling')
      setProgressMessages([])
      setProgress(0)
    }
  }, [isOpen, isAnalyzing])

  const getStageIcon = (stage: string, isActive: boolean, isCompleted: boolean) => {
    if (isCompleted) {
      return <CheckCircle2 className="w-5 h-5 text-green-600" />
    }
    if (isActive) {
      return <Loader2 className="w-5 h-5 animate-spin text-primary" />
    }
    return <div className="w-5 h-5 rounded-full border-2 border-muted" />
  }

  const stages = [
    { id: 'sampling', label: 'Sampling Data', icon: Database },
    { id: 'profiling', label: 'Profiling Data', icon: Sparkles },
    { id: 'bronze', label: 'Bronze Layer', icon: Database },
    { id: 'silver', label: 'Silver Layer', icon: Layers },
    { id: 'gold', label: 'Gold Layer', icon: TrendingUp }
  ]

  const getCurrentStageIndex = () => {
    return stages.findIndex(s => s.id === currentStage)
  }

  const renderAnalyzingView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
          <Sparkles className="w-8 h-8 text-primary animate-pulse" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          AI Data Architect Analyzing
        </h2>
        <p className="text-sm text-muted-foreground">
          Analyzing your data and generating optimal configuration recommendations...
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage, index) => {
          const stageIndex = getCurrentStageIndex()
          const isActive = index === stageIndex
          const isCompleted = index < stageIndex || (progress === 100 && index <= stageIndex)
          const Icon = stage.icon

          return (
            <div
              key={stage.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                isActive && 'bg-primary/5 border-primary/20',
                isCompleted && 'bg-green-50 border-green-200',
                !isActive && !isCompleted && 'bg-muted/30 border-transparent'
              )}
            >
              {getStageIcon(stage.id, isActive, isCompleted)}
              <Icon className={cn(
                'w-4 h-4',
                isActive && 'text-primary',
                isCompleted && 'text-green-600',
                !isActive && !isCompleted && 'text-muted-foreground'
              )} />
              <span className={cn(
                'text-sm font-medium',
                isActive && 'text-foreground',
                isCompleted && 'text-green-700',
                !isActive && !isCompleted && 'text-muted-foreground'
              )}>
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {/* Live Messages */}
      {progressMessages.length > 0 && (
        <div className="bg-muted/50 border rounded-lg p-4 max-h-40 overflow-y-auto">
          <div className="space-y-1">
            {progressMessages.map((msg, idx) => (
              <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                <ChevronRight className="w-3 h-3 mt-0.5 flex-shrink-0" />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderResultsView = () => {
    if (error || !result?.success) {
      return (
        <div className="space-y-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-destructive/10 rounded-full mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Analysis Failed
            </h2>
            <p className="text-sm text-muted-foreground">
              {error || result?.analysisSummary?.error || 'An unexpected error occurred during analysis'}
            </p>
          </div>

          <div className="flex justify-center">
            <Button onClick={onClose} variant="outline">
              Close
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Analysis Complete
          </h2>
          <p className="text-sm text-muted-foreground">
            AI recommendations generated for all three layers
          </p>
          {result.providerUsed && (
            <Badge variant="secondary" className="mt-2">
              Powered by {result.providerUsed === 'anthropic' ? 'Claude' : 'OpenAI'}
            </Badge>
          )}
        </div>

        {/* Layer Recommendations */}
        <div className="space-y-3">
          {/* Bronze */}
          <Card className="p-4 border-l-4 border-l-amber-500">
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Bronze Layer</h3>
                <p className="text-sm text-muted-foreground">
                  {result.bronze?.incremental_load?.enabled
                    ? `Incremental loading enabled using ${result.bronze.incremental_load.strategy}`
                    : 'Full snapshot loading recommended'}
                </p>
              </div>
              <Badge variant="outline">Raw Data</Badge>
            </div>
          </Card>

          {/* Silver */}
          <Card className="p-4 border-l-4 border-l-gray-400">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-gray-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Silver Layer</h3>
                <p className="text-sm text-muted-foreground">
                  {result.silver?.primary_key?.columns?.length > 0
                    ? `Primary key: ${result.silver.primary_key.columns.join(', ')}`
                    : 'Cleaned and validated data'}
                </p>
              </div>
              <Badge variant="outline">Refined Data</Badge>
            </div>
          </Card>

          {/* Gold */}
          <Card className="p-4 border-l-4 border-l-yellow-500">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1">Gold Layer</h3>
                <p className="text-sm text-muted-foreground">
                  {result.gold?.aggregations?.recommended_dimensions?.length > 0
                    ? `${result.gold.aggregations.recommended_dimensions.length} aggregations recommended`
                    : 'Business-ready analytics layer'}
                </p>
              </div>
              <Badge variant="outline">Analytics Ready</Badge>
            </div>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={onAccept} className="flex-1" size="lg">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Accept All Recommendations
          </Button>
          <Button onClick={onDiscard} variant="outline" size="lg">
            Discard
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Accepting will pre-fill all configuration fields. You can still modify them later.
        </p>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        onPointerDownOutside={(e) => isAnalyzing && e.preventDefault()}
        onEscapeKeyDown={(e) => isAnalyzing && e.preventDefault()}
      >
        {isAnalyzing ? renderAnalyzingView() : renderResultsView()}
      </DialogContent>
    </Dialog>
  )
}
