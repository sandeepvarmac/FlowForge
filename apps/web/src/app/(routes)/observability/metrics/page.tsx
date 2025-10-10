"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { BarChart3, TrendingUp, Clock, Zap, Activity, Timer } from 'lucide-react'

export default function MetricsPage() {
  const features = [
    { title: 'Real-Time Dashboards', description: 'Live metrics visualization with custom dashboards', icon: BarChart3 },
    { title: 'SLA Monitoring', description: 'Track and enforce service level agreements', icon: Timer },
    { title: 'Performance Trends', description: 'Historical performance analysis and forecasting', icon: TrendingUp },
    { title: 'Custom Metrics', description: 'Define and track business-specific metrics', icon: Zap },
    { title: 'Throughput Analysis', description: 'Records/sec, executions/hour, and capacity planning', icon: Activity },
    { title: 'Cost Tracking', description: 'Monitor compute costs and resource utilization', icon: Clock }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Metrics & Analytics</h1>
        <p className="text-foreground-muted mt-1">
          Comprehensive performance metrics, SLA tracking, and operational analytics
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-purple-50">
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-20 h-20 mx-auto mb-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Advanced Metrics & Analytics</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Deep insights into pipeline performance, resource utilization, and operational health with customizable dashboards
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-blue-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
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
