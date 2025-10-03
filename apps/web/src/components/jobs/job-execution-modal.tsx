'use client'

import * as React from 'react'
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Layers, CheckCircle, Clock, Database, FileText, ArrowRight, Activity, TrendingUp } from 'lucide-react'

interface JobExecutionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobName: string
  executionId: string
}

interface ExecutionMetadata {
  sourceInfo: {
    sourceSystem: string
    ingestionTimestamp: string
    batchId: string
    fileName: string
    fileSize: string
    recordCount: number
    checksumMD5: string
  }
  processingInfo: {
    executionId: string
    pipelineVersion: string
    dataLineage: string[]
    transformationsApplied: string[]
    qualityChecks: {
      name: string
      status: 'passed' | 'failed' | 'warning'
      details: string
    }[]
  }
  errorHandling: {
    deadLetterRecords: number
    errorSummary: {
      type: string
      count: number
      examples: string[]
    }[]
    notifications: string[]
  }
}

interface DataLayerResult {
  name: string
  status: 'completed' | 'running' | 'pending'
  recordCount: number
  columns: number
  processingTime: string
  sampleData: any[]
}

export function JobExecutionModal({ open, onOpenChange, jobName, executionId }: JobExecutionModalProps) {
  const [currentLayer, setCurrentLayer] = React.useState<'bronze' | 'silver' | 'gold'>('bronze')
  const [currentView, setCurrentView] = React.useState<'layers' | 'metadata' | 'errors'>('layers')

  // Enhanced execution metadata
  const executionMetadata: ExecutionMetadata = {
    sourceInfo: {
      sourceSystem: 'CRM_PROD',
      ingestionTimestamp: new Date().toISOString(),
      batchId: `batch_${executionId}`,
      fileName: 'Customers.csv',
      fileSize: '2.5MB',
      recordCount: 30,
      checksumMD5: 'a1b2c3d4e5f6g7h8i9j0'
    },
    processingInfo: {
      executionId: executionId,
      pipelineVersion: 'v2.1.3',
      dataLineage: ['CRM_PROD.customers', 'staging.raw_customers', 'bronze.customers', 'silver.customers', 'gold.customers'],
      transformationsApplied: [
        'Schema validation',
        'Data type casting',
        'Email format validation',
        'Phone number standardization',
        'Name case normalization',
        'Revenue calculation',
        'Customer segmentation'
      ],
      qualityChecks: [
        { name: 'Email format validation', status: 'passed', details: '28/30 records have valid emails' },
        { name: 'Phone number format', status: 'warning', details: '3 records have non-standard phone formats' },
        { name: 'Required fields check', status: 'passed', details: 'All required fields populated' },
        { name: 'Data type validation', status: 'passed', details: 'All fields match expected types' },
        { name: 'Business rule validation', status: 'passed', details: 'Revenue-segment consistency validated' }
      ]
    },
    errorHandling: {
      deadLetterRecords: 2,
      errorSummary: [
        {
          type: 'Invalid Email Format',
          count: 2,
          examples: ['sarah.wilson@invalid-email', 'chris@invalid.domain']
        },
        {
          type: 'Missing Phone Number',
          count: 3,
          examples: ['Customer ID: 5', 'Customer ID: 15', 'Customer ID: 22']
        }
      ],
      notifications: [
        'Email sent to data steward about email validation failures',
        'Slack notification posted to #data-quality channel',
        'Dead letter queue updated with 2 invalid records'
      ]
    }
  }
  
  // Simulated execution results
  const dataLayers: Record<string, DataLayerResult> = {
    bronze: {
      name: 'Bronze Layer (Raw Data)',
      status: 'completed',
      recordCount: 30,
      columns: 12,
      processingTime: '0.8s',
      sampleData: [
        { customer_id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@email.com', phone: '+1-555-123-4567', status: 'active', revenue: '12500.00' },
        { customer_id: '2', first_name: 'jane', last_name: 'DOE', email: 'jane.doe@gmail.com', phone: '(555) 234-5678', status: 'active', revenue: '8750.50' },
        { customer_id: '3', first_name: 'MICHAEL', last_name: 'johnson', email: 'michael@company.com', phone: '555.345.6789', status: 'inactive', revenue: '0.00' }
      ]
    },
    silver: {
      name: 'Silver Layer (Cleaned Data)',
      status: 'completed',
      recordCount: 28,
      columns: 15,
      processingTime: '1.2s',
      sampleData: [
        { customer_id: '1', first_name: 'John', last_name: 'Smith', email: 'john.smith@email.com', phone: '+1-555-123-4567', status: 'active', revenue: 12500.00, full_name: 'John Smith', is_active: true },
        { customer_id: '2', first_name: 'Jane', last_name: 'Doe', email: 'jane.doe@gmail.com', phone: '+1-555-234-5678', status: 'active', revenue: 8750.50, full_name: 'Jane Doe', is_active: true },
        { customer_id: '4', first_name: 'Sarah', last_name: 'Wilson', email: 'sarah.wilson@valid-email.com', phone: '+1-555-456-7890', status: 'active', revenue: 25000.75, full_name: 'Sarah Wilson', is_active: true }
      ]
    },
    gold: {
      name: 'Gold Layer (Business Ready)',
      status: 'completed',
      recordCount: 28,
      columns: 18,
      processingTime: '0.5s',
      sampleData: [
        { customer_id: '1', full_name: 'John Smith', email: 'john.smith@email.com', customer_segment: 'Enterprise', revenue: 12500.00, ltv: 45000.00, risk_score: 'Low', last_contact: '2024-09-10' },
        { customer_id: '2', full_name: 'Jane Doe', email: 'jane.doe@gmail.com', customer_segment: 'Premium', revenue: 8750.50, ltv: 32000.00, risk_score: 'Low', last_contact: '2024-09-12' },
        { customer_id: '4', full_name: 'Sarah Wilson', email: 'sarah.wilson@valid-email.com', customer_segment: 'Enterprise', revenue: 25000.75, ltv: 89000.00, risk_score: 'Low', last_contact: '2024-09-11' }
      ]
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="6xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            Job Execution Results: {jobName}
          </DialogTitle>
          <DialogDescription>
            Execution ID: {executionId} • Processing completed successfully
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6">
          {/* View Navigation */}
          <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setCurrentView('layers')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'layers' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Data Layers
            </button>
            <button
              onClick={() => setCurrentView('metadata')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'metadata' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Metadata & Lineage
            </button>
            <button
              onClick={() => setCurrentView('errors')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                currentView === 'errors' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Error Handling
            </button>
          </div>

          {currentView === 'layers' && (
            <>
              {/* Execution Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">Success</div>
                <div className="text-sm text-gray-600">Execution Status</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">2.5s</div>
                <div className="text-sm text-gray-600">Total Duration</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">28</div>
                <div className="text-sm text-gray-600">Records Processed</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-amber-600">3</div>
                <div className="text-sm text-gray-600">Layers Generated</div>
              </CardContent>
            </Card>
          </div>

          {/* Data Layer Pipeline */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers className="w-5 h-5" />
                Data Layer Pipeline Results
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-6">
                {(['bronze', 'silver', 'gold'] as const).map((layer, index) => (
                  <React.Fragment key={layer}>
                    <div 
                      className={`flex flex-col items-center cursor-pointer transition-all ${
                        currentLayer === layer ? 'scale-105' : 'opacity-70 hover:opacity-90'
                      }`}
                      onClick={() => setCurrentLayer(layer)}
                    >
                      <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-2 ${
                        layer === 'bronze' ? 'bg-amber-100 text-amber-700' :
                        layer === 'silver' ? 'bg-gray-100 text-gray-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        <Database className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <div className="font-semibold capitalize">{layer}</div>
                        <div className="text-xs text-gray-500">{dataLayers[layer].recordCount} records</div>
                        <Badge variant="outline" className="mt-1">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          {dataLayers[layer].processingTime}
                        </Badge>
                      </div>
                    </div>
                    {index < 2 && (
                      <ArrowRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Selected Layer Details */}
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">{dataLayers[currentLayer].name}</h3>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>{dataLayers[currentLayer].recordCount} records</span>
                    <span>{dataLayers[currentLayer].columns} columns</span>
                    <span>Processed in {dataLayers[currentLayer].processingTime}</span>
                  </div>
                </div>

                {/* Sample Data Table */}
                <div className="bg-white rounded border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(dataLayers[currentLayer].sampleData[0] || {}).map(col => (
                            <th key={col} className="text-left py-3 px-4 font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {dataLayers[currentLayer].sampleData.map((row, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-blue-50">
                            {Object.values(row).map((value, colIndex) => (
                              <td key={colIndex} className="py-3 px-4 border-r border-gray-100 last:border-r-0 font-mono text-xs">
                                {typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Layer-specific insights */}
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">Layer Insights</h4>
                  <div className="text-sm text-blue-800">
                    {currentLayer === 'bronze' && (
                      <ul className="space-y-1">
                        <li>• Raw CSV data loaded with 30 initial records</li>
                        <li>• Data quality issues detected: 2 invalid emails, 3 missing phone numbers</li>
                        <li>• All 12 source columns preserved</li>
                      </ul>
                    )}
                    {currentLayer === 'silver' && (
                      <ul className="space-y-1">
                        <li>• Data cleaning applied: standardized names, validated emails</li>
                        <li>• 2 records filtered out due to invalid email addresses</li>
                        <li>• Added calculated fields: full_name, is_active_customer</li>
                        <li>• Phone numbers standardized to E.164 format</li>
                      </ul>
                    )}
                    {currentLayer === 'gold' && (
                      <ul className="space-y-1">
                        <li>• Business transformations applied: customer segmentation, LTV calculation</li>
                        <li>• Risk scoring model applied based on customer behavior</li>
                        <li>• Enriched with contact history and engagement metrics</li>
                        <li>• Ready for business intelligence and reporting tools</li>
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Quality Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Data Quality Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">93.3%</div>
                  <div className="text-sm text-green-700">Data Quality Score</div>
                  <div className="text-xs text-gray-600 mt-1">28 of 30 records passed validation</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">15</div>
                  <div className="text-sm text-blue-700">Transformations Applied</div>
                  <div className="text-xs text-gray-600 mt-1">Name standardization, phone formatting, etc.</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">5</div>
                  <div className="text-sm text-purple-700">Business Rules Applied</div>
                  <div className="text-xs text-gray-600 mt-1">Segmentation, LTV, risk scoring</div>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
          )}

          {/* Metadata & Lineage View */}
          {currentView === 'metadata' && (
            <div className="space-y-6">
              {/* Source Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    Source Information & Lineage
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Source System</label>
                        <p className="font-mono text-sm">{executionMetadata.sourceInfo.sourceSystem}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Batch ID</label>
                        <p className="font-mono text-sm">{executionMetadata.sourceInfo.batchId}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">File Name</label>
                        <p className="font-mono text-sm">{executionMetadata.sourceInfo.fileName}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Checksum (MD5)</label>
                        <p className="font-mono text-sm">{executionMetadata.sourceInfo.checksumMD5}</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-700">Ingestion Timestamp</label>
                        <p className="text-sm">{new Date(executionMetadata.sourceInfo.ingestionTimestamp).toLocaleString()}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">File Size</label>
                        <p className="text-sm">{executionMetadata.sourceInfo.fileSize}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Record Count</label>
                        <p className="text-sm">{executionMetadata.sourceInfo.recordCount}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-700">Pipeline Version</label>
                        <p className="font-mono text-sm">{executionMetadata.processingInfo.pipelineVersion}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Data Lineage */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Lineage Flow</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between overflow-x-auto pb-4">
                    {executionMetadata.processingInfo.dataLineage.map((step, index) => (
                      <React.Fragment key={step}>
                        <div className="flex flex-col items-center min-w-[120px]">
                          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-2">
                            <Database className="w-6 h-6 text-blue-600" />
                          </div>
                          <p className="text-xs font-mono text-center">{step}</p>
                        </div>
                        {index < executionMetadata.processingInfo.dataLineage.length - 1 && (
                          <ArrowRight className="w-4 h-4 text-gray-400 mx-2 flex-shrink-0" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quality Checks */}
              <Card>
                <CardHeader>
                  <CardTitle>Data Quality Checks</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {executionMetadata.processingInfo.qualityChecks.map((check, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          {check.status === 'passed' && <CheckCircle className="w-5 h-5 text-green-600" />}
                          {check.status === 'warning' && <Clock className="w-5 h-5 text-amber-600" />}
                          {check.status === 'failed' && <Activity className="w-5 h-5 text-red-600" />}
                          <div>
                            <p className="font-medium text-sm">{check.name}</p>
                            <p className="text-xs text-gray-600">{check.details}</p>
                          </div>
                        </div>
                        <Badge variant={check.status === 'passed' ? 'default' : check.status === 'warning' ? 'secondary' : 'destructive'}>
                          {check.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Error Handling View */}
          {currentView === 'errors' && (
            <div className="space-y-6">
              {/* Error Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-red-600" />
                    Error Handling Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{executionMetadata.errorHandling.deadLetterRecords}</div>
                      <div className="text-sm text-red-700">Dead Letter Records</div>
                    </div>
                    <div className="text-center p-4 bg-amber-50 rounded-lg">
                      <div className="text-2xl font-bold text-amber-600">{executionMetadata.errorHandling.errorSummary.length}</div>
                      <div className="text-sm text-amber-700">Error Types</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{executionMetadata.errorHandling.notifications.length}</div>
                      <div className="text-sm text-blue-700">Notifications Sent</div>
                    </div>
                  </div>

                  {/* Error Details */}
                  <div className="space-y-4">
                    <h4 className="font-semibold">Error Breakdown</h4>
                    {executionMetadata.errorHandling.errorSummary.map((error, index) => (
                      <div key={index} className="border border-red-200 rounded-lg p-4 bg-red-50">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-red-800">{error.type}</h5>
                          <Badge variant="destructive">{error.count} records</Badge>
                        </div>
                        <div>
                          <p className="text-sm text-red-700 mb-2">Examples:</p>
                          <div className="space-y-1">
                            {error.examples.map((example, idx) => (
                              <p key={idx} className="text-xs font-mono bg-white p-2 rounded border text-red-600">
                                {example}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle>Automated Notifications</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {executionMetadata.errorHandling.notifications.map((notification, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                        <CheckCircle className="w-5 h-5 text-blue-600" />
                        <p className="text-sm">{notification}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
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
  )
}