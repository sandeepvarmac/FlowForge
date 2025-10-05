"use client"

import { Card, CardContent } from '@/components/ui'
import { BarChart3 } from 'lucide-react'

export default function Page() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <Card className="max-w-2xl w-full shadow-corporate-lg">
        <CardContent className="p-12 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-6">
            <BarChart3 className="w-10 h-10 text-blue-600" />
          </div>

          <h1 className="text-3xl font-bold text-foreground mb-4">
            Dashboard Overview
          </h1>

          <p className="text-lg text-foreground-secondary mb-6">
            Welcome to FlowForge Data Orchestration Platform
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-left">
            <p className="text-sm text-blue-800">
              <strong>Getting Started:</strong> Create your first workflow to see real-time metrics,
              execution history, and performance analytics displayed here.
            </p>
          </div>

          <div className="mt-8 text-sm text-foreground-muted">
            Navigate to <strong>Workflows</strong> to begin building your data pipelines
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

