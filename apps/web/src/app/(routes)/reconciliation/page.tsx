'use client'

import * as React from 'react'
import { Repeat, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'

export default function ReconciliationPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
          <Repeat className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Data Reconciliation
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What is Data Reconciliation?</h2>

          <p className="text-muted-foreground">
            Data Reconciliation ensures data integrity and accuracy by comparing datasets across different layers
            and sources. This feature will help you:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Source-to-Target Validation</p>
                <p className="text-sm text-muted-foreground">
                  Verify that data loaded into Bronze layer matches source files with row counts,
                  checksums, and control totals.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Layer-to-Layer Reconciliation</p>
                <p className="text-sm text-muted-foreground">
                  Track data transformations across Bronze → Silver → Gold layers, identifying
                  records added, modified, or filtered at each stage.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Business Rule Validation</p>
                <p className="text-sm text-muted-foreground">
                  Apply custom reconciliation rules to validate data quality, referential integrity,
                  and business logic compliance.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Exception Management</p>
                <p className="text-sm text-muted-foreground">
                  Automatically detect and flag reconciliation breaks with detailed drill-down
                  capabilities for investigation and resolution.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Audit Trail & Reports</p>
                <p className="text-sm text-muted-foreground">
                  Generate comprehensive reconciliation reports for compliance, auditing,
                  and operational monitoring.
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
