"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Settings, Upload, Tag, Shield, Users, FileText, Database, Palette } from 'lucide-react'

export default function AnalyticsHubAdminPage() {
  const features = [
    { title: 'Report Upload', description: 'Upload new reports dynamically via web interface with metadata', icon: Upload },
    { title: 'Metadata Management', description: 'Assign modules, departments, and tags for organization', icon: Tag },
    { title: 'Access Control', description: 'Define RBAC for each report with row-level security', icon: Shield },
    { title: 'User Management', description: 'Manage accounts, groups, and integrate with Azure AD/LDAP', icon: Users },
    { title: 'Report Configuration', description: 'Configure connections to Power BI, SSRS, and SharePoint', icon: FileText },
    { title: 'Metadata-Driven Config', description: 'JSON/database definitions with version control', icon: Database },
    { title: 'Audit Logging', description: 'Track all admin actions for compliance and governance', icon: Settings },
    { title: 'Portal Customization', description: 'Customize branding, themes, and layout for multi-tenant', icon: Palette }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Hub - Admin</h1>
        <p className="text-foreground-muted mt-1">
          Manage reports, configure access, and maintain the Analytics Hub portal
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-slate-50 to-gray-50">
        <CardContent className="p-12 text-center">
          <Settings className="w-20 h-20 mx-auto mb-6 text-slate-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Analytics Hub Admin Panel</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Comprehensive management capabilities for configuring reports, managing access, and maintaining the portal
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-slate-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-slate-600" />
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
