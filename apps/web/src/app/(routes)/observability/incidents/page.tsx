"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { AlertTriangle, Clock, TrendingUp, Shield, Bell, GitBranch } from 'lucide-react'

export default function IncidentsPage() {
  const features = [
    { title: 'Incident Timeline', description: 'Chronological view of all incidents with root cause analysis', icon: Clock },
    { title: 'Auto-Grouping', description: 'Automatically group related failures into incidents', icon: GitBranch },
    { title: 'Impact Assessment', description: 'Track affected workflows, jobs, and data assets', icon: TrendingUp },
    { title: 'Incident Response', description: 'Guided workflows for incident triage and resolution', icon: Shield },
    { title: 'Post-Mortem', description: 'Automatic generation of incident post-mortem reports', icon: Clock },
    { title: 'Notification Rules', description: 'Configure incident-specific notification channels', icon: Bell }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Incident Management</h1>
        <p className="text-foreground-muted mt-1">
          Track, manage, and resolve production incidents across your data pipelines
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-orange-50 to-yellow-50">
        <CardContent className="p-12 text-center">
          <AlertTriangle className="w-20 h-20 mx-auto mb-6 text-accent-orange" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Incident Management</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Comprehensive incident tracking and resolution workflows to minimize downtime and improve reliability
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-orange-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-accent-orange" />
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
