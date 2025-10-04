'use client'

import * as React from 'react'
import { Settings, Users, Shield, Database, Activity, Key } from 'lucide-react'

export default function AdminPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-slate-500/20 to-zinc-500/20 mb-4">
          <Settings className="w-12 h-12 text-slate-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-600 to-zinc-600 bg-clip-text text-transparent">
          Administration
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What is the Admin Panel?</h2>

          <p className="text-muted-foreground">
            The Administration panel provides enterprise-grade controls for managing users, security,
            system settings, and operational configurations. This feature will include:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">User & Team Management</p>
                <p className="text-sm text-muted-foreground">
                  Create and manage users, teams, and organizational units with role-based access
                  control (RBAC) and permission management.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Security & Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Configure SSO/SAML integration, multi-factor authentication, password policies,
                  and session management settings.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Key className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Secrets & Credentials</p>
                <p className="text-sm text-muted-foreground">
                  Securely store and manage API keys, database credentials, and connection strings
                  with encryption and access auditing.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Database className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">System Configuration</p>
                <p className="text-sm text-muted-foreground">
                  Configure global settings including storage locations, retention policies,
                  resource limits, and execution environments.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Activity className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Audit Logs & Compliance</p>
                <p className="text-sm text-muted-foreground">
                  Track all user actions, system changes, and data access with comprehensive
                  audit trails for compliance and security monitoring.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Settings className="w-5 h-5 text-slate-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Resource Management</p>
                <p className="text-sm text-muted-foreground">
                  Monitor and control compute resources, storage usage, and API quotas with
                  cost tracking and optimization recommendations.
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

