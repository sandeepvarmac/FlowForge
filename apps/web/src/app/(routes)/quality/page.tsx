"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Shield, CheckCircle2, AlertTriangle, TrendingUp, FileSearch, BarChart3, Zap, Database } from 'lucide-react'

export default function QualityPage() {
  const features = [
    { title: 'Data Validation Rules', description: 'Define rules for completeness, accuracy, consistency, and timeliness', icon: CheckCircle2 },
    { title: 'Anomaly Detection', description: 'ML-powered detection of outliers, duplicates, and anomalies', icon: AlertTriangle },
    { title: 'Quality Metrics & SLAs', description: 'Track quality scores and monitor SLA compliance in real-time', icon: TrendingUp },
    { title: 'Data Profiling', description: 'Automatic profiling for distributions, patterns, and statistics', icon: FileSearch },
    { title: 'Quality Reports & Alerts', description: 'Automated reports and alerts when issues are detected', icon: BarChart3 },
    { title: 'Rules Engine', description: 'Build complex validation rules using SQL, Python, or visual builders', icon: Zap },
    { title: 'Cross-Table Validation', description: 'Validate referential integrity across multiple tables', icon: Database },
    { title: 'Historical Trending', description: 'Track quality score trends over time with dashboards', icon: BarChart3 }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Quality</h1>
        <p className="text-foreground-muted mt-1">
          Monitor, validate, and ensure data accuracy and reliability throughout your pipelines
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-cyan-50">
        <CardContent className="p-12 text-center">
          <Shield className="w-20 h-20 mx-auto mb-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Data Quality</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Monitor, validate, and ensure the accuracy and reliability of your data throughout the entire pipeline
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
                <feature.icon className="w-6 h-6 text-blue-600" />
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
