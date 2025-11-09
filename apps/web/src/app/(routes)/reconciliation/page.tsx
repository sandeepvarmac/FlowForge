"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  Repeat,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  TrendingUp,
  Activity,
  BarChart3,
  Shield,
  Loader2,
  RefreshCw,
  ArrowRight,
  Info,
  AlertTriangle,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

interface ReconciliationRule {
  id: string
  workflow_id: string
  workflow_name: string
  rule_name: string
  rule_type: 'count' | 'sum' | 'hash' | 'column' | 'custom'
  source_layer: 'bronze' | 'silver' | 'gold'
  target_layer: 'bronze' | 'silver' | 'gold'
  source_table: string
  target_table: string | null
  column_name: string | null
  tolerance_percentage: number
  ai_generated: boolean
  confidence: number
  reasoning: string
  is_active: boolean
  created_at: number
  updated_at: number
}

interface ReconciliationExecution {
  id: string
  rule_id: string
  rule_name: string
  rule_type: string
  execution_id: string
  workflow_name: string
  execution_time: number
  status: 'passed' | 'failed' | 'warning'
  source_layer: string
  target_layer: string
  source_table: string
  target_table: string | null
  source_value: string
  target_value: string
  difference: string
  difference_percentage: number | null
  tolerance_percentage: number
  ai_explanation: string | null
  pass_threshold_met: boolean
  error_message: string | null
}

interface ExecutionSummary {
  total: number
  passed: number
  failed: number
  warning: number
  pass_rate: number
}

export default function ReconciliationPage() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [rules, setRules] = useState<ReconciliationRule[]>([])
  const [executions, setExecutions] = useState<ReconciliationExecution[]>([])
  const [executionSummary, setExecutionSummary] = useState<ExecutionSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch rules
      const rulesRes = await fetch('/api/reconciliation/rules')
      if (!rulesRes.ok) throw new Error('Failed to fetch rules')
      const rulesData = await rulesRes.json()
      setRules(rulesData.rules || [])

      // Fetch executions
      const execRes = await fetch('/api/reconciliation/executions?limit=100')
      if (!execRes.ok) throw new Error('Failed to fetch executions')
      const execData = await execRes.json()
      setExecutions(execData.executions || [])
      setExecutionSummary(execData.summary || null)

    } catch (err: any) {
      console.error('Error fetching reconciliation data:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const toggleRuleActive = async (ruleId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/reconciliation/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentStatus ? 0 : 1 })
      })

      if (!res.ok) throw new Error('Failed to update rule')
      await fetchData()
    } catch (err: any) {
      console.error('Error updating rule:', err)
      alert(`Failed to update rule: ${err.message}`)
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      passed: { variant: 'success' as const, icon: CheckCircle2, label: 'Passed' },
      failed: { variant: 'destructive' as const, icon: AlertCircle, label: 'Failed' },
      warning: { variant: 'warning' as const, icon: AlertTriangle, label: 'Warning' },
    }
    const config = variants[status as keyof typeof variants] || variants.warning
    const Icon = config.icon
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    )
  }

  const getRuleTypeBadge = (type: string) => {
    const colors = {
      count: 'bg-blue-100 text-blue-800',
      sum: 'bg-green-100 text-green-800',
      hash: 'bg-purple-100 text-purple-800',
      column: 'bg-orange-100 text-orange-800',
      custom: 'bg-gray-100 text-gray-800',
    }
    return (
      <Badge variant="outline" className={colors[type as keyof typeof colors] || colors.custom}>
        {type.toUpperCase()}
      </Badge>
    )
  }

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  const formatNumber = (value: string | number | null) => {
    if (value === null || value === undefined) return 'N/A'
    const num = typeof value === 'string' ? parseFloat(value) : value
    if (isNaN(num)) return value.toString()
    return num.toLocaleString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-foreground-muted">Loading reconciliation data...</span>
      </div>
    )
  }

  // Calculate active rules count
  const activeRulesCount = rules.filter(r => r.is_active).length

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Reconciliation</h1>
          <p className="text-foreground-muted mt-1">
            Ensure data integrity across Bronze → Silver → Gold layers
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="dashboard">
            <Activity className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="rules">
            <Shield className="w-4 h-4 mr-2" />
            Rules ({activeRulesCount})
          </TabsTrigger>
          <TabsTrigger value="executions">
            <BarChart3 className="w-4 h-4 mr-2" />
            Execution History
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rules.length}</div>
                <p className="text-xs text-muted-foreground">
                  {activeRulesCount} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {executionSummary ? `${executionSummary.pass_rate}%` : '—'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {executionSummary?.passed || 0} / {executionSummary?.total || 0} passed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Failed Checks</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {executionSummary?.failed || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {executionSummary?.warning || 0} warnings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{executions.length}</div>
                <p className="text-xs text-muted-foreground">
                  Last run: {executions[0] ? formatTimestamp(executions[0].execution_time) : 'Never'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Executions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Recent Reconciliation Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-12 text-foreground-muted">
                  <Repeat className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No reconciliation executions yet</p>
                  <p className="text-sm mt-2">Reconciliation runs automatically after each workflow execution</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.slice(0, 5).map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {exec.source_layer}
                          </Badge>
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                          <Badge variant="outline" className="text-xs">
                            {exec.target_layer}
                          </Badge>
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{exec.rule_name}</p>
                          <p className="text-sm text-foreground-muted">
                            {exec.workflow_name} • {formatTimestamp(exec.execution_time)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {getRuleTypeBadge(exec.rule_type)}
                        {getStatusBadge(exec.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Reconciliation Rules
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <div className="text-center py-12 text-foreground-muted">
                  <Shield className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No reconciliation rules configured</p>
                  <p className="text-sm mt-2">Rules will be created automatically when workflows are executed</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 border rounded-lg ${
                        rule.is_active ? 'bg-card' : 'bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold">{rule.rule_name}</h3>
                            {getRuleTypeBadge(rule.rule_type)}
                            {rule.ai_generated && (
                              <Badge variant="secondary" className="text-xs">
                                AI Generated
                              </Badge>
                            )}
                            {!rule.is_active && (
                              <Badge variant="outline" className="text-xs">
                                Inactive
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-sm text-foreground-muted mb-2">
                            <Database className="w-4 h-4" />
                            <span className="font-mono text-xs">
                              {rule.source_table}
                            </span>
                            <ArrowRight className="w-3 h-3" />
                            <span className="font-mono text-xs">
                              {rule.target_table || 'Same table'}
                            </span>
                            <span className="mx-2">•</span>
                            <Badge variant="outline" className="text-xs">
                              {rule.source_layer}
                            </Badge>
                            <ArrowRight className="w-3 h-3" />
                            <Badge variant="outline" className="text-xs">
                              {rule.target_layer}
                            </Badge>
                          </div>

                          {rule.tolerance_percentage > 0 && (
                            <div className="flex items-center gap-2 text-sm text-foreground-muted mb-2">
                              <Info className="w-4 h-4" />
                              <span>Tolerance: {rule.tolerance_percentage}%</span>
                            </div>
                          )}

                          {rule.reasoning && (
                            <p className="text-sm text-foreground-muted mt-2 italic">
                              "{rule.reasoning}"
                            </p>
                          )}

                          {rule.ai_generated && rule.confidence > 0 && (
                            <p className="text-xs text-foreground-muted mt-2">
                              AI Confidence: {rule.confidence}%
                            </p>
                          )}
                        </div>

                        <Button
                          variant={rule.is_active ? "outline" : "default"}
                          size="sm"
                          onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                        >
                          {rule.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Execution History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {executions.length === 0 ? (
                <div className="text-center py-12 text-foreground-muted">
                  <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No execution history available</p>
                  <p className="text-sm mt-2">Run a workflow to see reconciliation results</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {executions.map((exec) => (
                    <div key={exec.id} className="border rounded-lg">
                      <div
                        className="p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => setExpandedExecution(
                          expandedExecution === exec.id ? null : exec.id
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {expandedExecution === exec.id ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {exec.source_layer}
                              </Badge>
                              <ArrowRight className="w-3 h-3 text-muted-foreground" />
                              <Badge variant="outline" className="text-xs">
                                {exec.target_layer}
                              </Badge>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">{exec.rule_name}</p>
                              <p className="text-sm text-foreground-muted">
                                {exec.workflow_name || 'Unknown workflow'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            {getRuleTypeBadge(exec.rule_type)}
                            {getStatusBadge(exec.status)}
                            <span className="text-sm text-foreground-muted">
                              {formatTimestamp(exec.execution_time)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {expandedExecution === exec.id && (
                        <div className="border-t p-4 bg-muted/20 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs text-foreground-muted mb-1">Source Value</p>
                              <p className="font-mono text-sm font-semibold">
                                {formatNumber(exec.source_value)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-foreground-muted mb-1">Target Value</p>
                              <p className="font-mono text-sm font-semibold">
                                {formatNumber(exec.target_value)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-foreground-muted mb-1">Difference</p>
                              <p className={`font-mono text-sm font-semibold ${
                                exec.difference && parseFloat(exec.difference) !== 0
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}>
                                {formatNumber(exec.difference)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-foreground-muted mb-1">Variance</p>
                              <p className={`font-mono text-sm font-semibold ${
                                exec.difference_percentage && exec.difference_percentage > exec.tolerance_percentage
                                  ? 'text-red-600'
                                  : 'text-green-600'
                              }`}>
                                {exec.difference_percentage !== null
                                  ? `${exec.difference_percentage.toFixed(2)}%`
                                  : 'N/A'}
                              </p>
                            </div>
                          </div>

                          {exec.ai_explanation && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                              <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                AI Explanation
                              </p>
                              <p className="text-sm text-blue-900">{exec.ai_explanation}</p>
                            </div>
                          )}

                          {exec.error_message && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                              <p className="text-xs font-semibold text-red-800 mb-1 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                Error
                              </p>
                              <p className="text-sm text-red-900 font-mono">{exec.error_message}</p>
                            </div>
                          )}

                          <div className="flex items-center gap-4 text-xs text-foreground-muted pt-2 border-t">
                            <span>Rule ID: {exec.rule_id}</span>
                            <span>•</span>
                            <span>Execution ID: {exec.execution_id}</span>
                            <span>•</span>
                            <span>Tolerance: {exec.tolerance_percentage}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
