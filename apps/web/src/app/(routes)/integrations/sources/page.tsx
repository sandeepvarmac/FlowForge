'use client'

import * as React from 'react'
import { Plug, Database, Cloud, Webhook, FileType, Boxes } from 'lucide-react'

export default function IntegrationsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 mb-4">
          <Plug className="w-12 h-12 text-green-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
          Integrations
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What are Integrations?</h2>

          <p className="text-muted-foreground">
            Integrations allow FlowForge to seamlessly connect with external data sources, cloud platforms,
            databases, and third-party services. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Database Connectors</p>
                <p className="text-sm text-muted-foreground">
                  Connect to PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Cassandra, Redis, and other
                  popular databases with native drivers and connection pooling.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Cloud className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Cloud Platform Integration</p>
                <p className="text-sm text-muted-foreground">
                  Integrate with AWS (S3, RDS, Redshift), Azure (Blob Storage, SQL Database, Synapse),
                  Google Cloud (GCS, BigQuery), and Snowflake.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileType className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">File System Connectors</p>
                <p className="text-sm text-muted-foreground">
                  Access data from local filesystems, network shares (SMB/CIFS), SFTP servers, and
                  cloud object storage with unified file handling.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Webhook className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">API & Webhook Connectors</p>
                <p className="text-sm text-muted-foreground">
                  Connect to REST APIs, GraphQL endpoints, and configure webhooks for real-time data
                  ingestion from SaaS platforms and custom applications.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Boxes className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">SaaS Platform Integrations</p>
                <p className="text-sm text-muted-foreground">
                  Pre-built connectors for Salesforce, ServiceNow, Workday, SAP, Microsoft Dynamics,
                  and other enterprise SaaS platforms.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Plug className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Custom Integration Builder</p>
                <p className="text-sm text-muted-foreground">
                  Build custom integrations using Python SDK, REST API, or visual connector builder with
                  support for OAuth, API keys, and certificate-based authentication.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
