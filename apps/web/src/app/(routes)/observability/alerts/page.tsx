"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Bell, AlertTriangle, Mail, Shield, Clock, TrendingUp, Activity, BarChart3 } from 'lucide-react'

export default function AlertsPage() {
  const features = [
    { title: 'Alert Rule Builder', description: 'Configure alerts for workflow failures, quality issues, and SLA breaches', icon: AlertTriangle },
    { title: 'Multi-Channel Notifications', description: 'Email, Slack, Teams, PagerDuty, SMS, and webhooks', icon: Mail },
    { title: 'Alert Severity Levels', description: 'Critical, Warning, and Info with customizable escalation', icon: Shield },
    { title: 'Alert History & Tracking', description: 'Historical alerts, acknowledgments, and resolution times', icon: Clock },
    { title: 'Maintenance Windows', description: 'Schedule alert muting during planned maintenance periods', icon: Activity },
    { title: 'Alert Escalation', description: 'Automatic escalation if alerts are not acknowledged', icon: TrendingUp },
    { title: 'Performance Monitoring', description: 'Track execution times, resource usage, and SLA violations', icon: BarChart3 },
    { title: 'Alert Analytics', description: 'MTTD/MTTR metrics, alert trends, and correlation patterns', icon: BarChart3 }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Alert Management</h1>
        <p className="text-foreground-muted mt-1">
          Configure alert rules, manage active alerts, and track incident history
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-red-50 to-orange-50">
        <CardContent className="p-12 text-center">
          <Bell className="w-20 h-20 mx-auto mb-6 text-red-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Alert Management</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Stay informed about the health and performance of your data pipelines with intelligent alerting and real-time monitoring
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-red-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-red-600" />
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
