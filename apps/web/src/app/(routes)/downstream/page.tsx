'use client'

import * as React from 'react'
import { Send, Database, FileText, Cloud, HardDrive, Mail } from 'lucide-react'

export default function DownstreamFeedsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 mb-4">
          <Send className="w-12 h-12 text-purple-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Downstream Feeds
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What are Downstream Feeds?</h2>

          <p className="text-muted-foreground">
            Downstream Feeds enable you to distribute your processed data from Silver and Gold layers to
            various destination systems in the formats they require. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Database Destinations</p>
                <p className="text-sm text-muted-foreground">
                  Write directly to PostgreSQL, MySQL, SQL Server, Oracle, Snowflake, BigQuery,
                  and other relational databases with automatic schema management.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">File-Based Exports</p>
                <p className="text-sm text-muted-foreground">
                  Generate CSV, Parquet, JSON, XML, Avro, or custom delimited files with configurable
                  formatting, compression, and partitioning options.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">SFTP/FTP Delivery</p>
                <p className="text-sm text-muted-foreground">
                  Securely transfer files to remote servers via SFTP, FTPS, or FTP with automatic
                  retry logic and delivery confirmation.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Cloud className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Cloud Storage Integration</p>
                <p className="text-sm text-muted-foreground">
                  Push data to AWS S3, Azure Blob Storage, Google Cloud Storage, or other cloud
                  object stores with lifecycle management.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Send className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">API & Webhook Publishing</p>
                <p className="text-sm text-muted-foreground">
                  Send data to REST APIs, GraphQL endpoints, or trigger webhooks for real-time
                  integration with downstream applications.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Email Distribution</p>
                <p className="text-sm text-muted-foreground">
                  Automatically email reports, data extracts, or alerts to stakeholders with
                  scheduling and subscription management.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <p className="text-sm text-purple-600 dark:text-purple-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
