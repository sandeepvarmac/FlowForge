"use client"

import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Plus,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Zap,
  Mail,
  MessageSquare,
  Webhook,
  X,
  ChevronDown,
  BarChart3,
  Timer,
  Shield,
  Activity
} from 'lucide-react'

export default function AlertsPage() {
  const [activeTab, setActiveTab] = React.useState<'active' | 'rules' | 'history'>('active')
  const [showFilters, setShowFilters] = React.useState(false)
  const [filters, setFilters] = React.useState({
    severity: [] as string[],
    status: [] as string[],
    search: ''
  })

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Alert Management</h1>
          <p className="text-foreground-muted mt-1">
            Configure alert rules, manage active alerts, and track incident history
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" />
          Create Alert Rule
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-50">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">3</div>
                <div className="text-sm text-foreground-muted">Critical Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-50">
                <Bell className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">7</div>
                <div className="text-sm text-foreground-muted">Warning Alerts</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50">
                <CheckCircle className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">45</div>
                <div className="text-sm text-foreground-muted">Resolved (24h)</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50">
                <Settings className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">12</div>
                <div className="text-sm text-foreground-muted">Active Rules</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('active')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'active'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Bell className="w-4 h-4" />
          Active Alerts
          <Badge variant="destructive" className="ml-1">10</Badge>
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Settings className="w-4 h-4" />
          Alert Rules
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'history'
              ? 'border-primary text-primary font-medium'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Clock className="w-4 h-4" />
          History
        </button>
      </div>

      {activeTab === 'active' && <ActiveAlertsTab filters={filters} onFiltersChange={setFilters} />}
      {activeTab === 'rules' && <AlertRulesTab />}
      {activeTab === 'history' && <AlertHistoryTab />}

      {/* Coming Soon Features */}
      <ComingSoonFeatures />
    </div>
  )
}

// Active Alerts Tab
function ActiveAlertsTab({ filters, onFiltersChange }: any) {
  const mockAlerts = [
    {
      id: '1',
      title: 'High Execution Duration',
      description: 'Customer ETL Pipeline execution exceeded 5 minute threshold',
      severity: 'critical',
      status: 'firing',
      workflow: 'Customer ETL Pipeline',
      triggeredAt: '2 minutes ago',
      rule: 'Execution Duration > 5min',
      value: '7m 34s'
    },
    {
      id: '2',
      title: 'Failure Rate Exceeded',
      description: 'Product Sync workflow failure rate exceeded 20% in last hour',
      severity: 'critical',
      status: 'firing',
      workflow: 'Product Sync',
      triggeredAt: '15 minutes ago',
      rule: 'Failure Rate > 20%',
      value: '35%'
    },
    {
      id: '3',
      title: 'Data Volume Anomaly',
      description: 'Order data volume dropped by 60% compared to 7-day average',
      severity: 'warning',
      status: 'firing',
      workflow: 'Order Processing',
      triggeredAt: '1 hour ago',
      rule: 'Volume Drop > 50%',
      value: '-60%'
    }
  ]

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <input
                  type="text"
                  placeholder="Search alerts..."
                  className="w-full pl-10 pr-4 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  value={filters.search}
                  onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                />
              </div>
            </div>
            <button
              onClick={() => {}}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-md hover:bg-background-tertiary transition-colors"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Alert Cards */}
      <div className="space-y-3">
        {mockAlerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>

      {/* Empty State */}
      {mockAlerts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30 text-green-600" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No Active Alerts</h3>
            <p className="text-sm text-foreground-muted">
              All systems are running smoothly. Active alerts will appear here when triggered.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Alert Card Component
function AlertCard({ alert }: any) {
  const severityConfig: any = {
    critical: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', badge: 'destructive' },
    warning: { icon: Bell, color: 'text-yellow-600', bg: 'bg-yellow-50', badge: 'default' },
    info: { icon: Bell, color: 'text-blue-600', bg: 'bg-blue-50', badge: 'secondary' }
  }

  const config = severityConfig[alert.severity] || severityConfig.info
  const Icon = config.icon

  return (
    <Card className="border-l-4 border-l-red-600">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${config.bg}`}>
            <Icon className={`w-6 h-6 ${config.color}`} />
          </div>

          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold text-foreground">{alert.title}</h3>
                <p className="text-sm text-foreground-muted mt-1">{alert.description}</p>
              </div>
              <Badge variant={config.badge}>{alert.severity.toUpperCase()}</Badge>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
              <div>
                <span className="text-foreground-muted">Workflow:</span>
                <div className="font-medium text-foreground">{alert.workflow}</div>
              </div>
              <div>
                <span className="text-foreground-muted">Rule:</span>
                <div className="font-medium text-foreground">{alert.rule}</div>
              </div>
              <div>
                <span className="text-foreground-muted">Value:</span>
                <div className="font-medium text-foreground">{alert.value}</div>
              </div>
              <div>
                <span className="text-foreground-muted">Triggered:</span>
                <div className="font-medium text-foreground">{alert.triggeredAt}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-4">
              <button className="px-3 py-1.5 text-sm bg-primary text-white rounded-md hover:bg-primary/90 transition-colors">
                Acknowledge
              </button>
              <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-background-tertiary transition-colors">
                View Execution
              </button>
              <button className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-background-tertiary transition-colors">
                Mute 1h
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Alert Rules Tab
function AlertRulesTab() {
  const mockRules = [
    {
      id: '1',
      name: 'Execution Duration Threshold',
      description: 'Alert when execution duration exceeds 5 minutes',
      condition: 'duration > 5min',
      severity: 'critical',
      enabled: true,
      workflows: ['Customer ETL', 'Product Sync'],
      notifications: ['Email', 'Slack']
    },
    {
      id: '2',
      name: 'Failure Rate Monitor',
      description: 'Alert when failure rate exceeds 20% in 1 hour',
      condition: 'failure_rate > 20%',
      severity: 'critical',
      enabled: true,
      workflows: ['All Workflows'],
      notifications: ['Email', 'Slack', 'PagerDuty']
    },
    {
      id: '3',
      name: 'Data Volume Anomaly',
      description: 'Alert on significant data volume changes',
      condition: 'volume_change > 50%',
      severity: 'warning',
      enabled: true,
      workflows: ['Order Processing', 'Sales Analytics'],
      notifications: ['Email']
    }
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {mockRules.map((rule) => (
          <Card key={rule.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{rule.name}</h3>
                    <Badge variant={rule.severity === 'critical' ? 'destructive' : 'default'}>
                      {rule.severity}
                    </Badge>
                    {rule.enabled && <Badge variant="success">Enabled</Badge>}
                  </div>
                  <p className="text-sm text-foreground-muted mb-4">{rule.description}</p>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-foreground-muted">Condition:</span>
                      <div className="font-mono font-medium text-foreground mt-1">{rule.condition}</div>
                    </div>
                    <div>
                      <span className="text-foreground-muted">Workflows:</span>
                      <div className="font-medium text-foreground mt-1">{rule.workflows.join(', ')}</div>
                    </div>
                    <div>
                      <span className="text-foreground-muted">Notifications:</span>
                      <div className="flex items-center gap-2 mt-1">
                        {rule.notifications.map((channel) => (
                          <Badge key={channel} variant="secondary" className="text-xs">
                            {channel}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="p-2 hover:bg-background-tertiary rounded-md transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button className="p-2 hover:bg-background-tertiary rounded-md transition-colors text-error">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

// Alert History Tab
function AlertHistoryTab() {
  return (
    <Card>
      <CardContent className="p-12 text-center">
        <Clock className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Alert History</h3>
        <p className="text-sm text-foreground-muted">
          View resolved alerts, acknowledgment history, and alert trends over time
        </p>
        <Badge variant="secondary" className="mt-4">Coming Soon</Badge>
      </CardContent>
    </Card>
  )
}

// Coming Soon Features
function ComingSoonFeatures() {
  const features = [
    { title: 'Alert Correlation', description: 'Group related alerts and detect patterns', icon: Activity, phase: 'Phase 2' },
    { title: 'SLA Tracking', description: 'Monitor and enforce SLA compliance', icon: Timer, phase: 'Phase 2' },
    { title: 'Escalation Policies', description: 'Multi-tier alert escalation workflows', icon: TrendingUp, phase: 'Phase 2' },
    { title: 'Alert Analytics', description: 'MTTD/MTTR metrics and alert trends', icon: BarChart3, phase: 'Phase 2' },
    { title: 'Smart Alerting', description: 'AI-powered anomaly detection', icon: Zap, phase: 'Phase 3' },
    { title: 'Integration Hub', description: 'PagerDuty, ServiceNow, Jira integration', icon: Webhook, phase: 'Phase 3' }
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-foreground">Coming Soon</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2 border-gray-300 bg-gray-50/50">
            <CardContent className="p-6">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-gray-200">
                  <feature.icon className="w-5 h-5 text-gray-600" />
                </div>
                <Badge variant="secondary" className="text-xs">{feature.phase}</Badge>
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground-muted">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
