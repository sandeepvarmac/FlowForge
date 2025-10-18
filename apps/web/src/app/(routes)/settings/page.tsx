"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Settings, Users, Key, Bell, Shield, Palette, FileText, Database } from 'lucide-react'

export default function SettingsPage() {
  const features = [
    { title: 'User & Team Management', description: 'Manage users, teams, roles, and RBAC permissions with SSO integration', icon: Users },
    { title: 'Security & Authentication', description: 'Configure SAML, OAuth, LDAP, API keys, and MFA policies', icon: Key },
    { title: 'Notifications & Alerts', description: 'Email, Slack, Teams, and webhook notifications with templates', icon: Bell },
    { title: 'Audit Logging', description: 'Track all actions and changes for compliance (GDPR, HIPAA, SOC 2)', icon: Shield },
    { title: 'UI Customization', description: 'Customize themes, branding, logo, and color schemes', icon: Palette },
    { title: 'System Configuration', description: 'Environment variables, resource limits, retention policies', icon: Settings },
    { title: 'Connection Management', description: 'Manage database connections, cloud credentials, and API keys', icon: Database },
    { title: 'Backup & Recovery', description: 'Configure automated backups, retention, and disaster recovery', icon: FileText }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Settings</h1>
        <p className="text-foreground-muted mt-1">
          Configure system settings, user management, security, and application preferences
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-slate-50 to-gray-50">
        <CardContent className="p-12 text-center">
          <Settings className="w-20 h-20 mx-auto mb-6 text-slate-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Settings & Configuration</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Centralized configuration and management for your FlowForge instance including users, security, and system preferences
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
