"use client"

import { Card, CardContent, Badge } from '@/components/ui'
import { Upload, Database, Cloud, Webhook, FileType, Boxes, HardDrive, Zap } from 'lucide-react'

export default function SourcesPage() {
  const features = [
    { title: 'Database Connectors', description: 'PostgreSQL, MySQL, SQL Server, Oracle, MongoDB, Cassandra', icon: Database },
    { title: 'Cloud Platforms', description: 'AWS (S3, RDS, Redshift), Azure, Google Cloud, Snowflake', icon: Cloud },
    { title: 'File System', description: 'Local files, network shares (SMB/CIFS), SFTP servers', icon: FileType },
    { title: 'API & Webhooks', description: 'REST APIs, GraphQL endpoints, and real-time webhooks', icon: Webhook },
    { title: 'SaaS Platforms', description: 'Salesforce, ServiceNow, Workday, SAP, Microsoft Dynamics', icon: Boxes },
    { title: 'Streaming Sources', description: 'Kafka, Kinesis, Event Hubs, Pub/Sub for real-time data', icon: Zap },
    { title: 'FTP/SFTP', description: 'Secure file transfer from remote servers with automation', icon: HardDrive },
    { title: 'Custom Connectors', description: 'Build custom integrations using Python SDK or REST API', icon: Upload }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Source Integrations</h1>
        <p className="text-foreground-muted mt-1">
          Connect to databases, cloud platforms, APIs, SaaS applications, and file systems
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-green-50 to-emerald-50">
        <CardContent className="p-12 text-center">
          <Upload className="w-20 h-20 mx-auto mb-6 text-green-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Source Integrations</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Seamlessly connect to external data sources including databases, cloud platforms, APIs, and third-party services
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-green-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-green-600" />
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
