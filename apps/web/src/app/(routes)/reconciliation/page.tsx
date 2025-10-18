"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Repeat, CheckCircle2, AlertCircle, FileSearch, BarChart3, Shield, TrendingUp, Database } from 'lucide-react'

export default function ReconciliationPage() {
  const features = [
    { title: 'Source-to-Target Validation', description: 'Verify data matches source files with row counts and checksums', icon: CheckCircle2 },
    { title: 'Layer-to-Layer Recon', description: 'Track transformations across Bronze → Silver → Gold layers', icon: Database },
    { title: 'Business Rule Validation', description: 'Apply custom rules for quality and referential integrity', icon: Shield },
    { title: 'Exception Management', description: 'Detect and flag reconciliation breaks with drill-down', icon: AlertCircle },
    { title: 'Audit Trail & Reports', description: 'Generate comprehensive reports for compliance and auditing', icon: FileSearch },
    { title: 'Automated Reconciliation', description: 'Schedule automatic reconciliation runs after job completion', icon: Repeat },
    { title: 'Threshold Monitoring', description: 'Set acceptable variance thresholds and alert on breaches', icon: TrendingUp },
    { title: 'Historical Tracking', description: 'Track reconciliation history and trend analysis over time', icon: BarChart3 }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Reconciliation</h1>
        <p className="text-foreground-muted mt-1">
          Ensure data integrity by comparing datasets across layers and sources
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-purple-50">
        <CardContent className="p-12 text-center">
          <Repeat className="w-20 h-20 mx-auto mb-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Data Reconciliation</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Ensure data integrity and accuracy by comparing datasets across different layers and sources
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
