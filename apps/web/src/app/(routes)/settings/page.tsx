'use client'

import * as React from 'react'
import { Settings, Users, Key, Bell, Shield, Palette } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-500/20 to-zinc-500/20 mb-4">
          <Settings className="w-12 h-12 text-slate-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-600 to-zinc-600 bg-clip-text text-transparent">
          Settings
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What are Settings?</h2>

          <p className="text-muted-foreground">
            Settings provide centralized configuration and management for your FlowForge instance, including
            user management, security, notifications, and system preferences. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">User & Team Management</p>
                <p className="text-sm text-muted-foreground">
                  Manage users, teams, roles, and permissions with support for RBAC (Role-Based Access Control),
                  SSO integration, and user provisioning.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Key className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Security & Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Configure authentication methods (SAML, OAuth, LDAP), API keys, service accounts, and
                  security policies including MFA and session management.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Notifications & Alerts</p>
                <p className="text-sm text-muted-foreground">
                  Configure email, Slack, Teams, and webhook notifications for pipeline failures, data quality
                  issues, and system alerts with customizable templates.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Audit Logging & Compliance</p>
                <p className="text-sm text-muted-foreground">
                  Track all user actions, system changes, and data access with comprehensive audit logs for
                  compliance reporting (GDPR, HIPAA, SOC 2).
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Palette className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">UI Customization & Themes</p>
                <p className="text-sm text-muted-foreground">
                  Customize the user interface with themes, logo branding, color schemes, and layout preferences
                  to match your organization's identity.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">System Configuration</p>
                <p className="text-sm text-muted-foreground">
                  Configure system-wide settings including environment variables, resource limits, retention
                  policies, backup schedules, and integration endpoints.
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
