"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Download, Database, FileText, Cloud, Send, HardDrive, Zap, Settings } from 'lucide-react'

export default function DestinationsPage() {
  const features = [
    { title: 'Database Destinations', description: 'PostgreSQL, MySQL, SQL Server, Snowflake, BigQuery, Databricks', icon: Database },
    { title: 'File-Based Exports', description: 'CSV, Parquet, JSON, XML, Avro with compression and partitioning', icon: FileText },
    { title: 'Cloud Storage', description: 'AWS S3, Azure Blob, Data Lake, GCS with lifecycle management', icon: Cloud },
    { title: 'SFTP/FTP Delivery', description: 'Secure file transfer with retry logic and PGP encryption', icon: HardDrive },
    { title: 'API & Webhooks', description: 'REST APIs, GraphQL endpoints with batch and streaming modes', icon: Send },
    { title: 'Streaming Destinations', description: 'Kafka, Kinesis, Event Hubs with exactly-once delivery', icon: Zap },
    { title: 'Data Transformation', description: 'Column mapping, type conversions, and business rules', icon: Settings },
    { title: 'Schema Management', description: 'Automatic schema detection and evolution handling', icon: Database }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Destination Integrations</h1>
        <p className="text-foreground-muted mt-1">
          Distribute processed data to databases, cloud storage, APIs, and downstream systems
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-12 text-center">
          <Download className="w-20 h-20 mx-auto mb-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Destination Integrations</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Distribute your processed data from Silver and Gold layers to various downstream systems in the formats they require
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-blue-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-blue-600" />
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
