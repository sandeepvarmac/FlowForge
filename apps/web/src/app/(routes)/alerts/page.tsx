'use client'

import * as React from 'react'
import { Bell, AlertTriangle, CheckCircle2, Clock, TrendingUp, Users } from 'lucide-react'

export default function AlertsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 mb-4">
          <Bell className="w-12 h-12 text-red-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent">
          Alerts & Monitoring
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What are Alerts & Monitoring?</h2>

          <p className="text-muted-foreground">
            Stay informed about the health and performance of your data pipelines with intelligent
            alerting and monitoring capabilities. This feature will provide:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Pipeline Failure Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Get immediately notified when workflows fail, jobs error out, or data quality
                  checks don't pass critical thresholds.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Performance Monitoring</p>
                <p className="text-sm text-muted-foreground">
                  Track execution times, resource utilization, and throughput metrics with alerts
                  for performance degradation or SLA violations.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Data Quality Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Monitor data completeness, accuracy, consistency, and freshness with configurable
                  rules and automated anomaly detection.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Schedule & SLA Monitoring</p>
                <p className="text-sm text-muted-foreground">
                  Receive notifications when scheduled jobs don't run on time, miss their execution
                  windows, or violate defined service level agreements.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Users className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Multi-Channel Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Send alerts via email, Slack, Microsoft Teams, PagerDuty, SMS, or custom webhooks
                  with role-based routing and escalation policies.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Alert Management Dashboard</p>
                <p className="text-sm text-muted-foreground">
                  View, acknowledge, and resolve alerts from a centralized dashboard with historical
                  tracking and incident analysis capabilities.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
