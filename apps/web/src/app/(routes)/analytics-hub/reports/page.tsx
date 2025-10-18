"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { FolderKanban, BarChart3, PieChart, FileText, Filter, TrendingUp, Shield, Search } from 'lucide-react'

export default function AnalyticsHubReportsPage() {
  const features = [
    { title: 'Power BI Integration', description: 'Embed Power BI reports with interactive filters and real-time refresh', icon: BarChart3 },
    { title: 'SSRS Reports', description: 'Render SSRS paginated reports with export to PDF/Excel', icon: FileText },
    { title: 'Excel & Document Viewer', description: 'Display Excel files via Office Web Viewer with inline rendering', icon: PieChart },
    { title: 'Dynamic Report Catalog', description: 'Organize by modules, departments, and tags with advanced search', icon: FolderKanban },
    { title: 'SharePoint Integration', description: 'Link to SharePoint documents with role-based access control', icon: TrendingUp },
    { title: 'Custom Dashboards', description: 'Create dashboards using Tableau, Looker, or React components', icon: BarChart3 },
    { title: 'Role-Based Access', description: 'Integrate with Azure AD, LDAP, Okta for granular permissions', icon: Shield },
    { title: 'Usage Analytics', description: 'Track report views, downloads, and user interactions', icon: Search }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Analytics Hub - Reports</h1>
        <p className="text-foreground-muted mt-1">
          Centralized portal for enterprise reports from Power BI, SSRS, Excel, and SharePoint
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-violet-50 to-purple-50">
        <CardContent className="p-12 text-center">
          <FolderKanban className="w-20 h-20 mx-auto mb-6 text-violet-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Analytics Hub Reports Portal</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Modular web-based portal to consolidate and provide unified access to enterprise reports from various sources
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-violet-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-violet-600" />
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
