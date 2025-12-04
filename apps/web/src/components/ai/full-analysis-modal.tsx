'use client'

import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Database,
  TrendingUp,
  Bot,
  Zap,
  Settings2,
  BarChart3,
  Info,
  ArrowRight,
  FileSearch,
  Sparkles,
  Table2,
  Key,
  Filter,
  Calendar,
  Hash,
  Type,
  ToggleLeft,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ProgressEvent {
  type: 'progress'
  stage: string
  message: string
  detail?: string
  finding?: {
    type: 'column' | 'pattern' | 'recommendation' | 'warning' | 'info'
    icon?: string
    text: string
  }
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

interface Finding {
  id: string
  timestamp: Date
  stage: string
  type: 'column' | 'pattern' | 'recommendation' | 'warning' | 'info'
  text: string
  icon?: string
}

// Stage configuration with detailed info
const stageConfig = {
  sampling: {
    id: 'sampling',
    label: 'Sampling',
    description: 'Loading and sampling data rows',
    icon: FileSearch,
    color: 'blue',
    progressRange: [0, 10]
  },
  profiling: {
    id: 'profiling',
    label: 'Profiling',
    description: 'Analyzing column types, patterns, and statistics',
    icon: Table2,
    color: 'purple',
    progressRange: [10, 25]
  },
  bronze: {
    id: 'bronze',
    label: 'Bronze',
    description: 'Configuring raw data ingestion layer',
    icon: Database,
    color: 'amber',
    progressRange: [25, 50]
  },
  silver: {
    id: 'silver',
    label: 'Silver',
    description: 'Designing data cleansing and standardization',
    icon: Settings2,
    color: 'slate',
    progressRange: [50, 75]
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    description: 'Building analytics-ready aggregations',
    icon: TrendingUp,
    color: 'yellow',
    progressRange: [75, 100]
  }
}

const stages = Object.values(stageConfig)

// Icon mapping for findings
const findingIcons: Record<string, React.ElementType> = {
  key: Key,
  filter: Filter,
  calendar: Calendar,
  hash: Hash,
  type: Type,
  toggle: ToggleLeft,
  clock: Clock,
  sparkles: Sparkles,
  table: Table2,
  database: Database,
  settings: Settings2,
  chart: BarChart3
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
  const [currentStageMessage, setCurrentStageMessage] = React.useState<string>('Initializing analysis...')
  const [findings, setFindings] = React.useState<Finding[]>([])
  const [progress, setProgress] = React.useState(0)
  const [completedStages, setCompletedStages] = React.useState<Set<string>>(new Set())
  const findingsEndRef = React.useRef<HTMLDivElement>(null)
  const simulationRef = React.useRef<NodeJS.Timeout | null>(null)

  // Simulated stage progression with realistic timing and findings
  React.useEffect(() => {
    if (!isAnalyzing || !isOpen) return

    // Clear any existing simulation
    if (simulationRef.current) {
      clearTimeout(simulationRef.current)
    }

    const stageOrder = ['sampling', 'profiling', 'bronze', 'silver', 'gold']
    let currentIndex = 0

    // Simulated messages and findings for each stage
    const stageSimulations: Record<string, Array<{
      delay: number
      message: string
      finding?: { type: Finding['type']; text: string; icon?: string }
      progressAdd: number
    }>> = {
      sampling: [
        { delay: 300, message: 'Loading data sample...', progressAdd: 3 },
        { delay: 800, message: 'Preparing rows for analysis...', progressAdd: 4, finding: { type: 'info', text: 'Loading sample data from source', icon: 'table' } },
        { delay: 500, message: 'Sample loaded successfully', progressAdd: 3, finding: { type: 'info', text: 'Data sample ready for profiling', icon: 'database' } },
      ],
      profiling: [
        { delay: 400, message: 'Analyzing column data types...', progressAdd: 4 },
        { delay: 600, message: 'Detecting text and numeric columns...', progressAdd: 4, finding: { type: 'column', text: 'Analyzing column types and patterns', icon: 'type' } },
        { delay: 500, message: 'Identifying potential key columns...', progressAdd: 4, finding: { type: 'pattern', text: 'Scanning for identifier patterns', icon: 'key' } },
        { delay: 400, message: 'Profiling complete', progressAdd: 3 },
      ],
      bronze: [
        { delay: 500, message: 'Connecting to AI provider...', progressAdd: 5 },
        { delay: 1500, message: 'Analyzing ingestion strategy...', progressAdd: 8, finding: { type: 'info', text: 'AI analyzing optimal load patterns', icon: 'sparkles' } },
        { delay: 2000, message: 'Determining load strategy...', progressAdd: 7, finding: { type: 'recommendation', text: 'Evaluating incremental vs full load', icon: 'clock' } },
        { delay: 500, message: 'Bronze configuration complete', progressAdd: 5 },
      ],
      silver: [
        { delay: 400, message: 'Analyzing data cleansing requirements...', progressAdd: 5 },
        { delay: 1500, message: 'Identifying primary keys...', progressAdd: 7, finding: { type: 'pattern', text: 'Detecting unique identifiers', icon: 'key' } },
        { delay: 1500, message: 'Configuring deduplication rules...', progressAdd: 7, finding: { type: 'recommendation', text: 'Setting up quality rules', icon: 'filter' } },
        { delay: 500, message: 'Silver configuration complete', progressAdd: 6 },
      ],
      gold: [
        { delay: 400, message: 'Designing analytics layer...', progressAdd: 5 },
        { delay: 1500, message: 'Building aggregation metrics...', progressAdd: 8, finding: { type: 'recommendation', text: 'Configuring analytics metrics', icon: 'chart' } },
        { delay: 1500, message: 'Identifying dimensions...', progressAdd: 7, finding: { type: 'pattern', text: 'Setting up dimension columns', icon: 'table' } },
        { delay: 500, message: 'Finalizing configuration...', progressAdd: 5, finding: { type: 'info', text: 'Preparing final recommendations', icon: 'sparkles' } },
      ],
    }

    const runStageSimulation = (stageIndex: number, stepIndex: number) => {
      if (!isAnalyzing) return

      const stageName = stageOrder[stageIndex]
      if (!stageName) return

      const stageSteps = stageSimulations[stageName]
      if (!stageSteps) return

      // Update current stage
      setCurrentStage(stageName)

      const step = stageSteps[stepIndex]
      if (!step) {
        // Stage complete, move to next stage
        setCompletedStages(prev => new Set([...prev, stageName]))

        if (stageIndex < stageOrder.length - 1) {
          // Move to next stage after a brief pause
          simulationRef.current = setTimeout(() => {
            runStageSimulation(stageIndex + 1, 0)
          }, 300)
        }
        return
      }

      // Update message
      setCurrentStageMessage(step.message)

      // Update progress
      setProgress(prev => Math.min(prev + step.progressAdd, 95)) // Cap at 95% until real result

      // Add finding if present
      if (step.finding) {
        setFindings(prev => [...prev, {
          id: `sim-${Date.now()}-${Math.random()}`,
          timestamp: new Date(),
          stage: stageName,
          type: step.finding!.type,
          text: step.finding!.text,
          icon: step.finding!.icon
        }])
      }

      // Schedule next step
      simulationRef.current = setTimeout(() => {
        runStageSimulation(stageIndex, stepIndex + 1)
      }, step.delay)
    }

    // Start simulation
    runStageSimulation(0, 0)

    return () => {
      if (simulationRef.current) {
        clearTimeout(simulationRef.current)
      }
    }
  }, [isAnalyzing, isOpen])

  // Update when real result arrives
  React.useEffect(() => {
    if (result?.progressEvents && result.progressEvents.length > 0) {
      // Clear simulation when real data arrives
      if (simulationRef.current) {
        clearTimeout(simulationRef.current)
      }

      // Process real events and add any new findings
      result.progressEvents.forEach((event) => {
        if (event.finding) {
          // Check if this finding is already added (avoid duplicates)
          setFindings(prev => {
            const exists = prev.some(f => f.text === event.finding!.text && f.stage === event.stage)
            if (exists) return prev
            return [...prev, {
              id: `real-${Date.now()}-${Math.random()}`,
              timestamp: new Date(),
              stage: event.stage,
              type: event.finding!.type,
              text: event.finding!.text,
              icon: event.finding!.icon
            }]
          })
        }
      })

      // Set final stage and progress
      const lastEvent = result.progressEvents[result.progressEvents.length - 1]
      if (lastEvent) {
        setCurrentStage(lastEvent.stage)
        setCurrentStageMessage(lastEvent.message)
      }
    }

    if (result?.analysisSummary?.progress) {
      setProgress(result.analysisSummary.progress)
    }

    // Mark all stages as complete when done
    if (result?.success) {
      setCompletedStages(new Set(['sampling', 'profiling', 'bronze', 'silver', 'gold']))
      setProgress(100)
    }
  }, [result])

  // When complete, add summary findings from the result
  React.useEffect(() => {
    if (result?.success && !isAnalyzing) {
      const summaryFindings: Finding[] = []

      // Bronze findings
      if (result.bronze?.incremental_load?.enabled) {
        summaryFindings.push({
          id: 'bronze-incremental',
          timestamp: new Date(),
          stage: 'bronze',
          type: 'recommendation',
          text: `Incremental load recommended using "${result.bronze.incremental_load.watermark_column || 'timestamp'}" column`,
          icon: 'clock'
        })
      }

      // Silver findings
      if (result.silver?.primary_key?.columns?.length > 0) {
        summaryFindings.push({
          id: 'silver-pk',
          timestamp: new Date(),
          stage: 'silver',
          type: 'recommendation',
          text: `Primary key identified: ${result.silver.primary_key.columns.join(', ')}`,
          icon: 'key'
        })
      }
      if (result.silver?.deduplication?.enabled) {
        summaryFindings.push({
          id: 'silver-dedup',
          timestamp: new Date(),
          stage: 'silver',
          type: 'recommendation',
          text: `Deduplication strategy: keep ${result.silver.deduplication.strategy || 'latest'} record`,
          icon: 'filter'
        })
      }

      // Gold findings
      if (result.gold?.aggregation?.metrics?.length > 0) {
        summaryFindings.push({
          id: 'gold-metrics',
          timestamp: new Date(),
          stage: 'gold',
          type: 'recommendation',
          text: `${result.gold.aggregation.metrics.length} aggregation metrics configured`,
          icon: 'chart'
        })
      }

      if (summaryFindings.length > 0) {
        setFindings(prev => [...prev, ...summaryFindings])
      }
    }
  }, [result, isAnalyzing])

  // Auto-scroll findings
  React.useEffect(() => {
    findingsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [findings])

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen && isAnalyzing) {
      setCurrentStage('sampling')
      setCurrentStageMessage('Initializing analysis...')
      setFindings([])
      setProgress(0)
      setCompletedStages(new Set())

      // Add initial finding
      setFindings([{
        id: 'init',
        timestamp: new Date(),
        stage: 'sampling',
        type: 'info',
        text: 'Starting AI analysis pipeline...'
      }])
    }
  }, [isOpen, isAnalyzing])

  const getFindingIcon = (finding: Finding) => {
    if (finding.icon && findingIcons[finding.icon]) {
      const IconComponent = findingIcons[finding.icon]
      return <IconComponent className="w-3.5 h-3.5" />
    }

    switch (finding.type) {
      case 'column':
        return <Table2 className="w-3.5 h-3.5" />
      case 'pattern':
        return <Sparkles className="w-3.5 h-3.5" />
      case 'recommendation':
        return <CheckCircle2 className="w-3.5 h-3.5" />
      case 'warning':
        return <Info className="w-3.5 h-3.5" />
      default:
        return <Info className="w-3.5 h-3.5" />
    }
  }

  const getFindingColor = (finding: Finding) => {
    switch (finding.type) {
      case 'recommendation':
        return 'text-green-600 bg-green-50'
      case 'warning':
        return 'text-amber-600 bg-amber-50'
      case 'column':
        return 'text-blue-600 bg-blue-50'
      case 'pattern':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-slate-600 bg-slate-50'
    }
  }

  const getStageColor = (stage: string) => {
    const config = stageConfig[stage as keyof typeof stageConfig]
    if (!config) return 'slate'
    return config.color
  }

  const renderAnalyzingView = () => {
    const currentConfig = stageConfig[currentStage as keyof typeof stageConfig]

    return (
      <div className="flex-1 flex flex-col min-h-0 px-6 pb-4 gap-4">
        {/* Header with Progress */}
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0 p-2.5 bg-primary/10 rounded-xl">
            <Bot className="w-7 h-7 text-primary animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">
                {currentConfig?.description || 'Analyzing your data...'}
              </span>
              <span className="text-sm font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary via-primary to-primary/70 transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stage Pipeline */}
        <div className="flex items-center justify-between gap-1 p-3 bg-muted/30 rounded-xl">
          {stages.map((stage, index) => {
            const isActive = stage.id === currentStage
            const isCompleted = completedStages.has(stage.id)
            const Icon = stage.icon

            return (
              <React.Fragment key={stage.id}>
                <div className={cn(
                  'flex flex-col items-center gap-1.5 px-2 py-1.5 rounded-lg transition-all min-w-[60px]',
                  isActive && !isCompleted && 'bg-primary/10 ring-1 ring-primary/20',
                  isCompleted && 'bg-green-50'
                )}>
                  <div className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-sm',
                    isActive && !isCompleted && 'bg-primary text-white shadow-primary/25',
                    isCompleted && 'bg-green-500 text-white shadow-green-500/25',
                    !isActive && !isCompleted && 'bg-muted text-muted-foreground'
                  )}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4.5 h-4.5" />
                    ) : isActive ? (
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                    ) : (
                      <Icon className="w-4.5 h-4.5" />
                    )}
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold tracking-wide',
                    isActive && !isCompleted && 'text-primary',
                    isCompleted && 'text-green-600',
                    !isActive && !isCompleted && 'text-muted-foreground'
                  )}>
                    {stage.label}
                  </span>
                </div>
                {index < stages.length - 1 && (
                  <ArrowRight className={cn(
                    'w-3.5 h-3.5 flex-shrink-0 transition-colors',
                    completedStages.has(stage.id) ? 'text-green-500' : 'text-muted-foreground/30'
                  )} />
                )}
              </React.Fragment>
            )
          })}
        </div>

        {/* Current Stage Detail */}
        <div className="flex items-center gap-3 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
          <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
          <span className="text-sm text-foreground">{currentStageMessage}</span>
        </div>

        {/* Findings Feed */}
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              AI Findings
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {findings.length}
            </Badge>
          </div>
          <ScrollArea className="flex-1 h-[140px] rounded-lg border bg-muted/20">
            <div className="p-3 space-y-2">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-md text-xs animate-in fade-in slide-in-from-bottom-2 duration-300',
                    getFindingColor(finding)
                  )}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getFindingIcon(finding)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="leading-relaxed">{finding.text}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1 py-0 flex-shrink-0 capitalize',
                      `border-${getStageColor(finding.stage)}-300`
                    )}
                  >
                    {finding.stage}
                  </Badge>
                </div>
              ))}
              <div ref={findingsEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>
    )
  }

  const renderErrorView = () => (
    <div className="px-6 pb-4">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 p-3 bg-destructive/10 rounded-xl">
          <XCircle className="w-8 h-8 text-destructive" />
        </div>
        <div className="flex-1 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              {error || result?.analysisSummary?.error || 'An unexpected error occurred during analysis. Please try again.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <span>Check API keys</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <span>Verify data loaded</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
              <span>Check Python env</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderResultsView = () => {
    if (error || !result?.success) {
      return renderErrorView()
    }

    return (
      <div className="px-6 pb-4 space-y-4">
        {/* Success Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Configuration Ready</h3>
              <p className="text-sm text-muted-foreground">AI recommendations for all layers</p>
            </div>
          </div>
          {result.providerUsed && (
            <Badge variant="secondary" className="gap-1">
              <Zap className="w-3 h-3" />
              {result.providerUsed === 'anthropic' ? 'Claude' : 'GPT'}
            </Badge>
          )}
        </div>

        {/* Layer Cards */}
        <div className="grid grid-cols-3 gap-4">
          {/* Bronze Layer */}
          <Card className="p-4 border-t-4 border-t-amber-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-amber-50 rounded">
                <Database className="w-4 h-4 text-amber-600" />
              </div>
              <span className="font-semibold text-sm">Bronze</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {result.bronze?.incremental_load?.enabled
                ? `Incremental: ${result.bronze.incremental_load.watermark_column || 'timestamp'}`
                : 'Full snapshot load'}
            </p>
            {result.bronze?.storage_format && (
              <Badge variant="outline" className="mt-2 text-[10px]">
                {result.bronze.storage_format.format?.toUpperCase() || 'Parquet'}
              </Badge>
            )}
          </Card>

          {/* Silver Layer */}
          <Card className="p-4 border-t-4 border-t-slate-400">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-slate-100 rounded">
                <Settings2 className="w-4 h-4 text-slate-600" />
              </div>
              <span className="font-semibold text-sm">Silver</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {result.silver?.primary_key?.columns?.length > 0
                ? `PK: ${result.silver.primary_key.columns.slice(0, 2).join(', ')}${result.silver.primary_key.columns.length > 2 ? '...' : ''}`
                : 'Cleansed data'}
            </p>
            {result.silver?.deduplication?.enabled && (
              <Badge variant="outline" className="mt-2 text-[10px]">
                Dedup: {result.silver.deduplication.strategy || 'last'}
              </Badge>
            )}
          </Card>

          {/* Gold Layer */}
          <Card className="p-4 border-t-4 border-t-yellow-500">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-yellow-50 rounded">
                <BarChart3 className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="font-semibold text-sm">Gold</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {result.gold?.aggregation?.enabled
                ? `${result.gold.aggregation.metrics?.length || 0} metrics`
                : 'Analytics ready'}
            </p>
            {result.gold?.schedule && (
              <Badge variant="outline" className="mt-2 text-[10px]">
                {result.gold.schedule.frequency || 'daily'}
              </Badge>
            )}
          </Card>
        </div>

        {/* Info Note */}
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-800">
            Accept to pre-fill configuration. You can modify settings before saving.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] w-[90vw] max-w-4xl overflow-hidden flex flex-col"
        onPointerDownOutside={(e) => isAnalyzing && e.preventDefault()}
        onEscapeKeyDown={(e) => isAnalyzing && e.preventDefault()}
      >
        <DialogHeader className="pb-2 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Bot className="w-5 h-5 text-primary" />
            {isAnalyzing
              ? 'AI Data Architect'
              : (error || !result?.success)
                ? 'Analysis Failed'
                : 'Analysis Complete'}
          </DialogTitle>
          <DialogDescription className="text-sm">
            {isAnalyzing
              ? 'Analyzing your data to generate optimal Bronze, Silver, and Gold layer configurations...'
              : (error || !result?.success)
                ? 'Please review the error details below.'
                : 'Review the AI recommendations and accept to apply them.'}
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? renderAnalyzingView() : renderResultsView()}

        <DialogFooter className="pt-2 border-t flex-shrink-0">
          {isAnalyzing ? (
            <Button variant="ghost" disabled size="sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </Button>
          ) : (error || !result?.success) ? (
            <Button onClick={onClose} variant="outline" size="sm">
              Close
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onDiscard} size="sm">
                Discard
              </Button>
              <Button onClick={onAccept} size="sm" className="gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Accept Recommendations
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
