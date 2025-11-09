"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui'
import {
  Shield, Sparkles, CheckCircle2, AlertTriangle, Clock, Archive,
  ChevronRight, TrendingUp, TrendingDown, RefreshCw, Eye, Trash2,
  AlertCircle, Check, X, FileWarning
} from 'lucide-react'

interface QualityRule {
  id: string
  job_id: string
  rule_id: string
  rule_name: string
  column_name: string
  rule_type: string
  parameters: string
  confidence: number
  current_compliance: string
  reasoning: string
  ai_generated: number
  severity: 'error' | 'warning' | 'info'
  is_active: number
  created_at: number
}

interface RuleExecution {
  id: string
  rule_id: string
  job_execution_id: string
  execution_time: number
  status: 'passed' | 'failed' | 'warning' | 'skipped'
  records_checked: number
  records_passed: number
  records_failed: number
  pass_percentage: number
  failed_records_sample: string
  rule_name?: string
  rule_type?: string
  column_name?: string
}

interface QuarantineRecord {
  id: string
  rule_execution_id: string
  job_execution_id: string
  record_data: string
  failure_reason: string
  quarantine_status: 'quarantined' | 'approved' | 'rejected' | 'fixed'
  reviewed_by: string | null
  reviewed_at: number | null
  created_at: number
  rule_name?: string
  column_name?: string
}

export default function QualityPage() {
  const [activeTab, setActiveTab] = useState('ai-suggestions')
  const [rules, setRules] = useState<QualityRule[]>([])
  const [executions, setExecutions] = useState<RuleExecution[]>([])
  const [quarantined, setQuarantined] = useState<QuarantineRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalRules: 0,
    aiGenerated: 0,
    activeRules: 0,
    totalExecutions: 0,
    passedExecutions: 0,
    failedExecutions: 0,
    quarantinedRecords: 0,
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load quality rules
      const rulesRes = await fetch('/api/quality/rules?include_inactive=true')
      if (rulesRes.ok) {
        const rulesData = await rulesRes.json()
        setRules(rulesData.rules || [])
      }

      // Load executions
      const execRes = await fetch('/api/quality/executions')
      if (execRes.ok) {
        const execData = await execRes.json()
        setExecutions(execData.executions || [])
      }

      // Load quarantine
      const quarRes = await fetch('/api/quality/quarantine')
      if (quarRes.ok) {
        const quarData = await quarRes.json()
        setQuarantined(quarData.quarantined || [])
      }
    } catch (error) {
      console.error('Failed to load quality data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  useEffect(() => {
    const totalRules = rules.length
    const aiGenerated = rules.filter(r => r.ai_generated === 1).length
    const activeRules = rules.filter(r => r.is_active === 1).length
    const totalExecutions = executions.length
    const passedExecutions = executions.filter(e => e.status === 'passed').length
    const failedExecutions = executions.filter(e => e.status === 'failed').length
    const quarantinedRecords = quarantined.filter(q => q.quarantine_status === 'quarantined').length

    setStats({
      totalRules,
      aiGenerated,
      activeRules,
      totalExecutions,
      passedExecutions,
      failedExecutions,
      quarantinedRecords,
    })
  }, [rules, executions, quarantined])

  const toggleRuleActive = async (ruleId: string, currentActive: number) => {
    try {
      const res = await fetch(`/api/quality/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: currentActive === 1 ? 0 : 1 }),
      })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to toggle rule:', error)
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return

    try {
      const res = await fetch(`/api/quality/rules/${ruleId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to delete rule:', error)
    }
  }

  const getSeverityBadge = (severity: string) => {
    const colors = {
      error: 'bg-red-100 text-red-700 border-red-200',
      warning: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      info: 'bg-blue-100 text-blue-700 border-blue-200',
    }
    return colors[severity as keyof typeof colors] || colors.info
  }

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      not_null: 'Not Null',
      unique: 'Unique',
      range: 'Range',
      pattern: 'Pattern',
      enum: 'Enum',
      custom: 'Custom',
    }
    return labels[type] || type
  }

  const aiSuggestedRules = rules.filter(r => r.ai_generated === 1 && r.is_active === 0)
  const activeRulesList = rules.filter(r => r.is_active === 1)
  const archivedRules = rules.filter(r => r.is_active === 0 && r.ai_generated === 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Shield className="w-8 h-8 text-blue-600" />
            Data Quality
          </h1>
          <p className="text-foreground-muted mt-1">
            AI-powered quality monitoring and validation
          </p>
        </div>
        <Button onClick={loadData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted">Total Rules</p>
                <p className="text-2xl font-bold mt-1">{stats.totalRules}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  {stats.aiGenerated} AI-generated
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted">Active Rules</p>
                <p className="text-2xl font-bold mt-1">{stats.activeRules}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  Enforced in Silver
                </p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted">Executions</p>
                <p className="text-2xl font-bold mt-1">{stats.totalExecutions}</p>
                <p className="text-xs text-green-600 mt-1">
                  {stats.passedExecutions} passed, {stats.failedExecutions} failed
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground-muted">Quarantined</p>
                <p className="text-2xl font-bold mt-1">{stats.quarantinedRecords}</p>
                <p className="text-xs text-foreground-muted mt-1">
                  Records in quarantine
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="ai-suggestions" className="gap-2">
            <Sparkles className="w-4 h-4" />
            AI Suggestions ({aiSuggestedRules.length})
          </TabsTrigger>
          <TabsTrigger value="active-rules" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Active Rules ({activeRulesList.length})
          </TabsTrigger>
          <TabsTrigger value="execution-history" className="gap-2">
            <Clock className="w-4 h-4" />
            Execution History ({executions.length})
          </TabsTrigger>
          <TabsTrigger value="quarantine" className="gap-2">
            <FileWarning className="w-4 h-4" />
            Quarantine ({stats.quarantinedRecords})
          </TabsTrigger>
        </TabsList>

        {/* AI Suggestions Tab */}
        <TabsContent value="ai-suggestions" className="space-y-4">
          {aiSuggestedRules.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Sparkles className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-foreground-muted">No AI suggestions yet</p>
                <p className="text-sm text-foreground-muted mt-2">
                  Run a Bronze ingestion job to generate AI-powered quality rule suggestions
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {aiSuggestedRules.map(rule => (
                <Card key={rule.id} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <Sparkles className="w-5 h-5 text-blue-600" />
                          <h3 className="font-semibold text-lg">{rule.rule_name}</h3>
                          <Badge className={getSeverityBadge(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            {getRuleTypeLabel(rule.rule_type)}
                          </Badge>
                          <Badge variant="outline" className="gap-1 bg-purple-50 text-purple-700 border-purple-200">
                            <TrendingUp className="w-3 h-3" />
                            {rule.confidence}% confidence
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                          <div>
                            <p className="text-foreground-muted">Column</p>
                            <p className="font-medium">{rule.column_name}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Current Compliance</p>
                            <p className="font-medium">{rule.current_compliance}</p>
                          </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">AI Reasoning:</p>
                          <p className="text-sm text-blue-800">{rule.reasoning}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                          className="gap-1"
                        >
                          <Check className="w-4 h-4" />
                          Activate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteRule(rule.id)}
                          className="gap-1 text-red-600 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active Rules Tab */}
        <TabsContent value="active-rules" className="space-y-4">
          {activeRulesList.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-foreground-muted">No active rules</p>
                <p className="text-sm text-foreground-muted mt-2">
                  Activate AI suggestions or create custom rules
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRulesList.map(rule => (
                <Card key={rule.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          <h3 className="font-semibold text-lg">{rule.rule_name}</h3>
                          <Badge className={getSeverityBadge(rule.severity)}>
                            {rule.severity}
                          </Badge>
                          <Badge variant="outline">
                            {getRuleTypeLabel(rule.rule_type)}
                          </Badge>
                          {rule.ai_generated === 1 && (
                            <Badge variant="outline" className="gap-1 bg-blue-50 text-blue-700 border-blue-200">
                              <Sparkles className="w-3 h-3" />
                              AI-Generated
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-foreground-muted">Column</p>
                            <p className="font-medium">{rule.column_name}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Confidence</p>
                            <p className="font-medium">{rule.confidence}%</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Compliance</p>
                            <p className="font-medium">{rule.current_compliance}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => toggleRuleActive(rule.id, rule.is_active)}
                        >
                          Deactivate
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => deleteRule(rule.id)}
                          className="text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Execution History Tab */}
        <TabsContent value="execution-history" className="space-y-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-foreground-muted">No executions yet</p>
                <p className="text-sm text-foreground-muted mt-2">
                  Quality rules will execute automatically during Silver transformation
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {executions.map(exec => (
                <Card key={exec.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          {exec.status === 'passed' ? (
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          ) : exec.status === 'failed' ? (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-yellow-600" />
                          )}
                          <h3 className="font-semibold">{exec.rule_name || exec.rule_id}</h3>
                          <Badge className={exec.status === 'passed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {exec.status}
                          </Badge>
                          <Badge variant="outline">{exec.rule_type}</Badge>
                        </div>

                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-foreground-muted">Column</p>
                            <p className="font-medium">{exec.column_name}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Records Checked</p>
                            <p className="font-medium">{exec.records_checked.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Passed</p>
                            <p className="font-medium text-green-600">{exec.records_passed.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-foreground-muted">Failed</p>
                            <p className="font-medium text-red-600">{exec.records_failed.toLocaleString()}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm text-foreground-muted">Pass Rate</span>
                            <span className="text-sm font-medium">{exec.pass_percentage.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${exec.pass_percentage >= 90 ? 'bg-green-600' : exec.pass_percentage >= 70 ? 'bg-yellow-600' : 'bg-red-600'}`}
                              style={{ width: `${exec.pass_percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Quarantine Tab */}
        <TabsContent value="quarantine" className="space-y-4">
          {quarantined.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <FileWarning className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-foreground-muted">No quarantined records</p>
                <p className="text-sm text-foreground-muted mt-2">
                  Records that fail quality checks will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {quarantined.filter(q => q.quarantine_status === 'quarantined').map(record => {
                let recordData: any = {}
                try {
                  recordData = JSON.parse(record.record_data)
                } catch (e) {
                  recordData = { error: 'Failed to parse record data' }
                }

                return (
                  <Card key={record.id} className="border-l-4 border-l-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <AlertTriangle className="w-5 h-5 text-orange-600" />
                            <h3 className="font-semibold">{record.failure_reason}</h3>
                            <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                              {record.quarantine_status}
                            </Badge>
                          </div>

                          <div className="bg-gray-50 p-4 rounded-lg font-mono text-xs overflow-x-auto">
                            <pre>{JSON.stringify(recordData, null, 2)}</pre>
                          </div>

                          <p className="text-xs text-foreground-muted mt-2">
                            Quarantined on {new Date(record.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
