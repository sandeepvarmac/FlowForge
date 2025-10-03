'use client'

import * as React from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge, Input } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { FormField, FormLabel, Textarea } from '@/components/ui/form'
import { Database, FileText, Tag, Clock, User, GitBranch, Shield, Activity, Search, Filter } from 'lucide-react'

interface MetadataEntry {
  id: string
  entityType: 'dataset' | 'column' | 'transformation' | 'job'
  entityName: string
  businessName?: string
  description?: string
  owner: string
  tags: string[]
  technicalMetadata: {
    dataType?: string
    format?: string
    size?: string
    partitioning?: string
    compression?: string
    location?: string
  }
  businessMetadata: {
    businessDomain?: string
    dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted'
    piiFields?: string[]
    dataQualityScore?: number
    businessRules?: string[]
  }
  lineage: {
    upstream: string[]
    downstream: string[]
    transformations: string[]
  }
  governance: {
    steward: string
    lastReviewed?: Date
    retentionPolicy?: string
    accessLevel: 'public' | 'restricted' | 'private'
  }
  createdAt: Date
  updatedAt: Date
}

interface MetadataCatalogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialFilter?: string
}

export function MetadataCatalog({ open, onOpenChange, initialFilter }: MetadataCatalogProps) {
  const [searchTerm, setSearchTerm] = React.useState(initialFilter || '')
  const [selectedType, setSelectedType] = React.useState<string>('all')
  const [selectedEntry, setSelectedEntry] = React.useState<MetadataEntry | null>(null)
  const [showDetails, setShowDetails] = React.useState(false)

  // Sample metadata entries
  const metadataEntries: MetadataEntry[] = [
    {
      id: 'dataset_customers_bronze',
      entityType: 'dataset',
      entityName: 'customers_bronze',
      businessName: 'Customer Raw Data',
      description: 'Raw customer data ingested from CSV files containing customer registration and demographic information',
      owner: 'data-engineering@company.com',
      tags: ['customers', 'bronze', 'raw-data', 'csv'],
      technicalMetadata: {
        dataType: 'table',
        format: 'parquet',
        size: '2.5MB',
        partitioning: 'ingestion_date',
        compression: 'snappy',
        location: 's3://data-lake/bronze/customers/'
      },
      businessMetadata: {
        businessDomain: 'Customer Management',
        dataClassification: 'internal',
        piiFields: ['email', 'phone', 'first_name', 'last_name'],
        dataQualityScore: 85,
        businessRules: ['Email must be unique', 'Customer ID is immutable']
      },
      lineage: {
        upstream: ['source_system_crm'],
        downstream: ['customers_silver'],
        transformations: []
      },
      governance: {
        steward: 'jane.smith@company.com',
        lastReviewed: new Date('2024-09-01'),
        retentionPolicy: '7 years',
        accessLevel: 'restricted'
      },
      createdAt: new Date('2024-09-12'),
      updatedAt: new Date('2024-09-12')
    },
    {
      id: 'dataset_customers_silver',
      entityType: 'dataset',
      entityName: 'customers_silver',
      businessName: 'Customer Cleansed Data',
      description: 'Cleansed and validated customer data with standardized formats and enrichments',
      owner: 'data-engineering@company.com',
      tags: ['customers', 'silver', 'cleansed', 'validated'],
      technicalMetadata: {
        dataType: 'table',
        format: 'delta',
        size: '2.2MB',
        partitioning: 'country, status',
        compression: 'zstd',
        location: 's3://data-lake/silver/customers/'
      },
      businessMetadata: {
        businessDomain: 'Customer Management',
        dataClassification: 'internal',
        piiFields: ['email', 'phone', 'full_name'],
        dataQualityScore: 95,
        businessRules: ['All emails validated', 'Phone numbers in E.164 format', 'Names standardized']
      },
      lineage: {
        upstream: ['customers_bronze'],
        downstream: ['customers_gold', 'customer_analytics'],
        transformations: ['data_cleansing_job', 'validation_job']
      },
      governance: {
        steward: 'jane.smith@company.com',
        lastReviewed: new Date('2024-09-10'),
        retentionPolicy: '7 years',
        accessLevel: 'restricted'
      },
      createdAt: new Date('2024-09-12'),
      updatedAt: new Date('2024-09-12')
    },
    {
      id: 'column_email',
      entityType: 'column',
      entityName: 'email',
      businessName: 'Customer Email Address',
      description: 'Primary email address for customer communication',
      owner: 'data-engineering@company.com',
      tags: ['email', 'contact', 'pii', 'identifier'],
      technicalMetadata: {
        dataType: 'string',
        format: 'email'
      },
      businessMetadata: {
        businessDomain: 'Customer Contact',
        dataClassification: 'confidential',
        piiFields: ['email'],
        dataQualityScore: 92,
        businessRules: ['Must be valid email format', 'Unique across customers']
      },
      lineage: {
        upstream: ['source_crm.email'],
        downstream: ['marketing_campaigns.email'],
        transformations: ['email_validation', 'lowercase_transform']
      },
      governance: {
        steward: 'privacy@company.com',
        lastReviewed: new Date('2024-09-05'),
        retentionPolicy: 'As per customer consent',
        accessLevel: 'private'
      },
      createdAt: new Date('2024-09-12'),
      updatedAt: new Date('2024-09-12')
    }
  ]

  const filteredEntries = metadataEntries.filter(entry => {
    const matchesSearch = searchTerm === '' || 
      entry.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    
    const matchesType = selectedType === 'all' || entry.entityType === selectedType
    
    return matchesSearch && matchesType
  })

  const getClassificationColor = (classification: string) => {
    switch (classification) {
      case 'public': return 'bg-green-100 text-green-800'
      case 'internal': return 'bg-blue-100 text-blue-800'
      case 'confidential': return 'bg-orange-100 text-orange-800'
      case 'restricted': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'dataset': return <Database className="w-4 h-4" />
      case 'column': return <FileText className="w-4 h-4" />
      case 'transformation': return <GitBranch className="w-4 h-4" />
      case 'job': return <Activity className="w-4 h-4" />
      default: return <Database className="w-4 h-4" />
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent size="6xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="w-5 h-5 text-primary" />
              Metadata Catalog
            </DialogTitle>
            <DialogDescription>
              Centralized metadata management for all data assets, lineage, and governance
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Search and Filters */}
            <div className="flex gap-4 mb-6">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search datasets, columns, transformations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={selectedType === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('all')}
                >
                  All
                </Button>
                <Button
                  variant={selectedType === 'dataset' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('dataset')}
                >
                  Datasets
                </Button>
                <Button
                  variant={selectedType === 'column' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('column')}
                >
                  Columns
                </Button>
                <Button
                  variant={selectedType === 'transformation' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedType('transformation')}
                >
                  Transformations
                </Button>
              </div>
            </div>

            {/* Metadata Entries */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredEntries.map((entry) => (
                <Card key={entry.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => { setSelectedEntry(entry); setShowDetails(true) }}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getEntityIcon(entry.entityType)}
                        <div>
                          <CardTitle className="text-sm font-semibold">{entry.businessName || entry.entityName}</CardTitle>
                          <p className="text-xs text-gray-500 font-mono">{entry.entityName}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {entry.entityType}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">{entry.description}</p>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3 h-3 text-gray-400" />
                        <Badge variant="outline" 
                               className={`text-xs ${getClassificationColor(entry.businessMetadata.dataClassification!)}`}>
                          {entry.businessMetadata.dataClassification}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-600">{entry.governance.steward}</span>
                      </div>
                      
                      {entry.businessMetadata.dataQualityScore && (
                        <div className="flex items-center gap-2">
                          <Activity className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-600">
                            Quality: {entry.businessMetadata.dataQualityScore}%
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1 mt-3">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {entry.tags.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{entry.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredEntries.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No metadata entries found</p>
                <p className="text-sm">Try adjusting your search criteria</p>
              </div>
            )}
          </div>

          <div className="border-t p-4 flex justify-end">
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Metadata Details Modal */}
      {selectedEntry && (
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent size="4xl" className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getEntityIcon(selectedEntry.entityType)}
                {selectedEntry.businessName || selectedEntry.entityName}
              </DialogTitle>
              <DialogDescription>
                Detailed metadata for {selectedEntry.entityType}: {selectedEntry.entityName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 p-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Entity Name</label>
                      <p className="font-mono text-sm">{selectedEntry.entityName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Business Name</label>
                      <p className="text-sm">{selectedEntry.businessName || 'Not specified'}</p>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium text-gray-700">Description</label>
                      <p className="text-sm text-gray-600">{selectedEntry.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Technical Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Technical Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(selectedEntry.technicalMetadata).map(([key, value]) => (
                      value && (
                        <div key={key}>
                          <label className="text-sm font-medium text-gray-700 capitalize">
                            {key.replace(/([A-Z])/g, ' $1')}
                          </label>
                          <p className="font-mono text-sm">{value}</p>
                        </div>
                      )
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Business Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Business Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Business Domain</label>
                      <p className="text-sm">{selectedEntry.businessMetadata.businessDomain}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data Classification</label>
                      <Badge className={getClassificationColor(selectedEntry.businessMetadata.dataClassification!)}>
                        {selectedEntry.businessMetadata.dataClassification}
                      </Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data Quality Score</label>
                      <p className="text-sm font-semibold text-green-600">
                        {selectedEntry.businessMetadata.dataQualityScore}%
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">PII Fields</label>
                      <div className="flex flex-wrap gap-1">
                        {selectedEntry.businessMetadata.piiFields?.map(field => (
                          <Badge key={field} variant="outline" className="text-xs">
                            {field}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Lineage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Data Lineage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Upstream Dependencies</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedEntry.lineage.upstream.map(dep => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Downstream Dependencies</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedEntry.lineage.downstream.map(dep => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Governance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Governance & Compliance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Data Steward</label>
                      <p className="text-sm">{selectedEntry.governance.steward}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Access Level</label>
                      <Badge variant="outline">{selectedEntry.governance.accessLevel}</Badge>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Retention Policy</label>
                      <p className="text-sm">{selectedEntry.governance.retentionPolicy}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Last Reviewed</label>
                      <p className="text-sm">
                        {selectedEntry.governance.lastReviewed?.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="border-t p-4 flex justify-end">
              <Button onClick={() => setShowDetails(false)}>
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}