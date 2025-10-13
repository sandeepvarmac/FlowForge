'use client'

import * as React from 'react'
import { Download, Database, FileText, Cloud, Send, HardDrive } from 'lucide-react'

export default function DestinationsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-8">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-500/20 mb-4">
          <Download className="w-12 h-12 text-blue-600" />
        </div>

        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          Destination Integrations
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Coming Soon
        </p>

        <div className="bg-background-secondary border border-border rounded-lg p-8 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-4">What are Destination Integrations?</h2>

          <p className="text-muted-foreground">
            Destination Integrations enable you to distribute your processed data from Silver and Gold layers to
            various downstream systems in the formats they require. This feature will support:
          </p>

          <ul className="space-y-3 mt-4">
            <li className="flex items-start gap-3">
              <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Database Destinations</p>
                <p className="text-sm text-muted-foreground">
                  Write directly to PostgreSQL, MySQL, SQL Server, Oracle, Snowflake, BigQuery,
                  Databricks, and other data warehouses with automatic schema management and upsert logic.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">File-Based Exports</p>
                <p className="text-sm text-muted-foreground">
                  Generate CSV, Parquet, JSON, XML, Avro, ORC, or custom delimited files with configurable
                  formatting, compression (GZIP, ZSTD, Snappy), and partitioning strategies.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Cloud className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Cloud Storage Destinations</p>
                <p className="text-sm text-muted-foreground">
                  Push data to AWS S3, Azure Blob Storage, Azure Data Lake, Google Cloud Storage, or other cloud
                  object stores with automatic partitioning and lifecycle management.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <HardDrive className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">SFTP/FTP Delivery</p>
                <p className="text-sm text-muted-foreground">
                  Securely transfer files to remote servers via SFTP, FTPS, or FTP with automatic
                  retry logic, delivery confirmation, and PGP encryption support.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Send className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">API & Webhook Publishing</p>
                <p className="text-sm text-muted-foreground">
                  Send data to REST APIs, GraphQL endpoints, or trigger webhooks for real-time
                  integration with downstream applications. Supports batch and streaming modes.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Send className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Streaming Destinations</p>
                <p className="text-sm text-muted-foreground">
                  Stream data to Kafka, Kinesis, Event Hubs, or Pub/Sub for real-time data pipelines
                  and event-driven architectures with exactly-once delivery guarantees.
                </p>
              </div>
            </li>

            <li className="flex items-start gap-3">
              <Database className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Data Transformation & Mapping</p>
                <p className="text-sm text-muted-foreground">
                  Apply custom transformations, column mapping, data type conversions, and business rules
                  before writing to destinations. Supports SQL, Python, and visual mapping tools.
                </p>
              </div>
            </li>
          </ul>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              <strong>Coming in Phase 2:</strong> This feature is currently under development and will be
              available in the next major release of FlowForge.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
