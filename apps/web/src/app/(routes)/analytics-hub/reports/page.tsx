'use client'

import * as React from 'react'
import { LineChart, FolderKanban, BarChart3, PieChart, TrendingUp, Filter } from 'lucide-react'

export default function AnalyticsHubReportsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 mb-4">
          <FolderKanban className="w-12 h-12 text-violet-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
          Analytics Hub - Reports
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What is the Analytics Hub Reports Portal?</h2>

          <p className="text-muted-foreground">
            The Analytics Hub provides a centralized, modular, web-based portal to consolidate and provide
            unified access to enterprise reports from various sources. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Power BI Integration</p>
                <p className="text-sm text-muted-foreground">
                  Embed Power BI reports and dashboards directly in the portal using iframes or Power BI REST APIs.
                  Support for interactive filters, drill-through, and real-time data refresh.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <PieChart className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">SSRS Reports</p>
                <p className="text-sm text-muted-foreground">
                  Render SQL Server Reporting Services (SSRS) reports using report viewer components or direct links.
                  Support for paginated reports, subscriptions, and export to PDF/Excel.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FolderKanban className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Excel & Document Viewer</p>
                <p className="text-sm text-muted-foreground">
                  Display Excel files via Office Web Viewer with preview and direct download options.
                  Support for Word, PowerPoint, and PDF documents with inline rendering.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Filter className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Dynamic Report Catalog</p>
                <p className="text-sm text-muted-foreground">
                  Reports organized by modules (Holdings, Cash, Performance, Tax), departments (Credit, PE, GIS),
                  and custom tags (Daily, Monthly, Quarterly). Advanced search, filter, and favorites.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">SharePoint Integration</p>
                <p className="text-sm text-muted-foreground">
                  Link to SharePoint-hosted documents with role-based access control. Support for document libraries,
                  version history, and collaborative editing.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <LineChart className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Custom Dashboards</p>
                <p className="text-sm text-muted-foreground">
                  Create custom interactive dashboards using Tableau, Looker, Metabase, or custom React components.
                  Support for data visualization, real-time updates, and drill-down capabilities.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <BarChart3 className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Role-Based Access Control</p>
                <p className="text-sm text-muted-foreground">
                  Integrate with enterprise identity providers (Azure AD, LDAP, Okta) for authentication.
                  Granular permissions ensure users only see reports they're authorized to access.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Usage Analytics & Audit Trail</p>
                <p className="text-sm text-muted-foreground">
                  Track report views, downloads, and user interactions. Generate usage reports for compliance
                  and optimization. Full audit logging for data governance requirements.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <p className="text-sm text-violet-600 dark:text-violet-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
