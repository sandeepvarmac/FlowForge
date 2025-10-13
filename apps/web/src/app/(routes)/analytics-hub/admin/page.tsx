'use client'

import * as React from 'react'
import { Settings, Upload, Users, Tag, Shield, FileText } from 'lucide-react'

export default function AnalyticsHubAdminPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-500/20 to-gray-500/20 mb-4">
          <Settings className="w-12 h-12 text-slate-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-600 to-gray-600 bg-clip-text text-transparent">
          Analytics Hub - Admin
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What is the Analytics Hub Admin Panel?</h2>

          <p className="text-muted-foreground">
            The Admin Panel provides comprehensive management capabilities for the Analytics Hub, enabling
            administrators to configure reports, manage access, and maintain the portal. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Report Upload & Configuration</p>
                <p className="text-sm text-muted-foreground">
                  Upload new reports dynamically via web interface. Configure report metadata including title,
                  description, report type (Power BI, SSRS, Excel, Custom), and connection parameters.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Metadata Management</p>
                <p className="text-sm text-muted-foreground">
                  Assign modules (Holdings, Cash Transactions, Performance, Tax), departments (Credit, Private Equity, GIS),
                  and custom tags (Daily, Quarterly, Monthly) to organize reports for easy discovery.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Access Control & Permissions</p>
                <p className="text-sm text-muted-foreground">
                  Define role-based access controls (RBAC) for each report. Assign permissions to users, groups,
                  or departments. Support for row-level security and data filtering by user context.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Users className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">User & Group Management</p>
                <p className="text-sm text-muted-foreground">
                  Manage user accounts, create groups, and assign permissions. Integrate with enterprise directory
                  services (Azure AD, LDAP) for automated provisioning and de-provisioning.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Report Source Configuration</p>
                <p className="text-sm text-muted-foreground">
                  Configure connections to Power BI workspaces, SSRS servers, SharePoint sites, and file storage.
                  Manage authentication credentials, API keys, and service accounts securely.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Metadata-Driven Configuration</p>
                <p className="text-sm text-muted-foreground">
                  Use JSON or database-based metadata definitions to control which reports appear, their display
                  layout, access controls, and behavior. Support for version control and rollback.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Audit Logging & Compliance</p>
                <p className="text-sm text-muted-foreground">
                  Track all administrative actions including report uploads, permission changes, and configuration
                  updates. Generate compliance reports for auditing and governance requirements.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Portal Customization</p>
                <p className="text-sm text-muted-foreground">
                  Customize portal branding, themes, and layout. Configure landing pages, featured reports,
                  and promotional banners. Support for multi-tenant configurations.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-slate-500/10 border border-slate-500/20 rounded-lg">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
