'use client'

import * as React from 'react'
import { Shield, CheckCircle2, AlertTriangle, TrendingUp, FileSearch, BarChart3 } from 'lucide-react'

export default function QualityPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 mb-4">
          <Shield className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
          Data Quality
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What is Data Quality?</h2>

          <p className="text-muted-foreground">
            Data Quality tools help you monitor, validate, and ensure the accuracy and reliability of your data
            throughout the entire pipeline. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Data Validation Rules</p>
                <p className="text-sm text-muted-foreground">
                  Define custom validation rules for completeness, accuracy, consistency, and timeliness checks
                  across all layers of your data pipeline.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Anomaly Detection</p>
                <p className="text-sm text-muted-foreground">
                  Automatically detect outliers, duplicates, null values, and statistical anomalies with
                  machine learning-powered analysis.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Quality Metrics & SLAs</p>
                <p className="text-sm text-muted-foreground">
                  Track data quality scores, set quality thresholds, and monitor SLA compliance with
                  real-time dashboards and historical trending.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileSearch className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Data Profiling</p>
                <p className="text-sm text-muted-foreground">
                  Automatically profile datasets to understand distributions, patterns, cardinality, and
                  data types with comprehensive statistical analysis.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Quality Reports & Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Generate automated quality reports and receive alerts when data quality issues are
                  detected, with configurable notification rules.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Data Quality Rules Engine</p>
                <p className="text-sm text-muted-foreground">
                  Build complex validation rules using SQL, Python, or visual rule builders with support
                  for cross-table validations and business logic.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
