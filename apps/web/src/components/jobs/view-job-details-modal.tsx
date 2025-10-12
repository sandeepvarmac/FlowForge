'use client'

import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { Job } from '@/types/workflow'
import {
  FileText,
  Database,
  Cloud,
  Layers,
  GitBranch,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  AlertCircle
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface ViewJobDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  job: Job | null
}

const getJobTypeIcon = (type: string) => {
  switch (type) {
    case 'file-based': return <FileText className="w-5 h-5" />
    case 'database': return <Database className="w-5 h-5" />
    case 'nosql': return <Database className="w-5 h-5" />
    case 'api': return <Cloud className="w-5 h-5" />
    case 'gold-analytics': return <Layers className="w-5 h-5" />
    default: return <FileText className="w-5 h-5" />
  }
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'completed': return 'success'
    case 'ready': return 'default'
    case 'running': return 'default'
    case 'configured': return 'secondary'
    case 'disabled': return 'secondary'
    case 'failed': return 'destructive'
    default: return 'secondary'
  }
}

export function ViewJobDetailsModal({ open, onOpenChange, job }: ViewJobDetailsModalProps) {
  if (!job) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" size="2xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              {getJobTypeIcon(job.type)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{job.name}</span>
                <Badge variant={getStatusVariant(job.status)}>
                  {job.status}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            {job.description || 'No description provided'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <Tabs defaultValue="overview" className="mt-2">
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="transformations">Transformations</TabsTrigger>
              <TabsTrigger value="validation">Validation</TabsTrigger>
              <TabsTrigger value="layers">Pipeline Layers</TabsTrigger>
            </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Job Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground-muted">Job ID</p>
                    <p className="font-mono text-sm">{job.id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Execution Order</p>
                    <p className="font-semibold">{job.order}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Job Type</p>
                    <p className="font-semibold capitalize">{job.type.replace('-', ' ')}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Status</p>
                    <Badge variant={getStatusVariant(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                </div>

                {job.lastRun && (
                  <div className="pt-3 border-t">
                    <p className="text-sm text-foreground-muted mb-1">Last Run</p>
                    <p className="font-semibold">
                      {new Intl.DateTimeFormat('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).format(job.lastRun)}
                      <span className="text-sm text-foreground-muted ml-2">
                        ({formatDistanceToNow(job.lastRun, { addSuffix: true })})
                      </span>
                    </p>
                  </div>
                )}

                <div className="pt-3 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-foreground-muted">Created</p>
                      <p className="text-sm">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }).format(job.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-foreground-muted">Last Updated</p>
                      <p className="text-sm">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        }).format(job.updatedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Source Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground-muted">Source Name</p>
                    <p className="font-semibold">{job.sourceConfig.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">Source Type</p>
                    <p className="font-semibold capitalize">{job.sourceConfig.type}</p>
                  </div>
                </div>

                {job.sourceConfig.fileConfig && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-sm font-medium">File Configuration</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-foreground-muted">File Path:</span>
                        <p className="font-mono text-xs mt-1 break-all">{job.sourceConfig.fileConfig.filePath}</p>
                      </div>
                      {job.sourceConfig.fileConfig.uploadMode && (
                        <div>
                          <span className="text-foreground-muted">Upload Mode:</span>
                          <p className="font-semibold capitalize mt-1">{job.sourceConfig.fileConfig.uploadMode}</p>
                        </div>
                      )}
                      {job.sourceConfig.fileConfig.filePattern && (
                        <div>
                          <span className="text-foreground-muted">File Pattern:</span>
                          <p className="font-mono text-xs mt-1">{job.sourceConfig.fileConfig.filePattern}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-foreground-muted">Has Header:</span>
                        <p className="mt-1">
                          {job.sourceConfig.fileConfig.hasHeader ? (
                            <CheckCircle className="w-4 h-4 inline text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 inline text-red-600" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {job.sourceConfig.databaseConfig && (
                  <div className="pt-3 border-t space-y-2">
                    <p className="text-sm font-medium">Database Configuration</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      {job.sourceConfig.databaseConfig.tableName && (
                        <div>
                          <span className="text-foreground-muted">Table Name:</span>
                          <p className="font-mono text-xs mt-1">{job.sourceConfig.databaseConfig.tableName}</p>
                        </div>
                      )}
                      {job.sourceConfig.databaseConfig.query && (
                        <div className="col-span-2">
                          <span className="text-foreground-muted">SQL Query:</span>
                          <pre className="bg-background-secondary p-2 rounded text-xs mt-1 overflow-x-auto">
                            {job.sourceConfig.databaseConfig.query}
                          </pre>
                        </div>
                      )}
                      <div>
                        <span className="text-foreground-muted">Incremental:</span>
                        <p className="mt-1">
                          {job.sourceConfig.databaseConfig.isIncremental ? (
                            <CheckCircle className="w-4 h-4 inline text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 inline text-gray-400" />
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transformations Tab */}
          <TabsContent value="transformations" className="space-y-4 mt-4">
            {job.transformationConfig ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <GitBranch className="w-4 h-4" />
                      Column Mappings ({job.transformationConfig.columnMappings.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {job.transformationConfig.columnMappings.map((mapping, index) => (
                        <div key={index} className="flex items-center gap-3 p-2 bg-background-secondary rounded-lg">
                          <div className="flex-1">
                            <p className="font-mono text-sm">{mapping.sourceColumn}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-foreground-muted" />
                          <div className="flex-1">
                            <p className="font-mono text-sm">{mapping.targetColumn}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {mapping.dataType}
                          </Badge>
                          {mapping.transformations && mapping.transformations.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              {mapping.transformations.length} transforms
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {job.transformationConfig.lookups && job.transformationConfig.lookups.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Database className="w-4 h-4" />
                        Lookup Tables ({job.transformationConfig.lookups.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {job.transformationConfig.lookups.map((lookup, index) => (
                          <div key={index} className="p-3 bg-background-secondary rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-semibold">{lookup.name}</p>
                              <Badge variant="outline">
                                {lookup.sourceTable}
                              </Badge>
                            </div>
                            <div className="text-sm space-y-1">
                              <p className="text-foreground-muted">
                                Join Keys: {lookup.joinKeys.map(jk => `${jk.sourceColumn} = ${jk.targetColumn}`).join(', ')}
                              </p>
                              <p className="text-foreground-muted">
                                Selected Columns: {lookup.selectColumns.join(', ')}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <GitBranch className="w-12 h-12 mx-auto mb-3 text-foreground-muted opacity-50" />
                  <p className="text-foreground-muted">No transformations configured</p>
                  <p className="text-sm text-foreground-muted mt-1">
                    This job does not have any column mappings or lookups defined.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Validation Tab */}
          <TabsContent value="validation" className="space-y-4 mt-4">
            {job.validationConfig ? (
              <>
                {job.validationConfig.dataQualityRules && job.validationConfig.dataQualityRules.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Data Quality Rules ({job.validationConfig.dataQualityRules.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {job.validationConfig.dataQualityRules.map((rule, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-background-secondary rounded-lg">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-semibold text-sm">{rule.name}</p>
                                <Badge variant={rule.severity === 'error' ? 'destructive' : 'warning'}>
                                  {rule.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-foreground-muted">
                                Column: <span className="font-mono">{rule.column}</span>
                              </p>
                              <p className="text-sm text-foreground-muted">
                                Rule Type: <span className="font-semibold">{rule.ruleType}</span>
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {job.validationConfig.reconciliationRules && job.validationConfig.reconciliationRules.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Reconciliation Rules ({job.validationConfig.reconciliationRules.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {job.validationConfig.reconciliationRules.map((rule, index) => (
                          <div key={index} className="p-3 bg-background-secondary rounded-lg">
                            <p className="font-semibold text-sm mb-2">{rule.name}</p>
                            <div className="text-sm space-y-1">
                              <p className="text-foreground-muted">
                                Source: <span className="font-mono">{rule.sourceJob}</span>
                              </p>
                              <p className="text-foreground-muted">
                                Target: <span className="font-mono">{rule.targetJob}</span>
                              </p>
                              <p className="text-foreground-muted">
                                Column: <span className="font-mono">{rule.reconciliationColumn}</span>
                              </p>
                              {rule.tolerance && (
                                <p className="text-foreground-muted">
                                  Tolerance: <span className="font-semibold">{rule.tolerance}%</span>
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(!job.validationConfig.dataQualityRules || job.validationConfig.dataQualityRules.length === 0) &&
                 (!job.validationConfig.reconciliationRules || job.validationConfig.reconciliationRules.length === 0) && (
                  <Card>
                    <CardContent className="text-center py-12">
                      <Shield className="w-12 h-12 mx-auto mb-3 text-foreground-muted opacity-50" />
                      <p className="text-foreground-muted">No validation rules configured</p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-foreground-muted opacity-50" />
                  <p className="text-foreground-muted">No validation configured</p>
                  <p className="text-sm text-foreground-muted mt-1">
                    This job does not have any data quality or reconciliation rules defined.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Pipeline Layers Tab */}
          <TabsContent value="layers" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Bronze Layer */}
              <Card className="border-l-4 border-l-amber-500">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                      B
                    </div>
                    Bronze Layer
                    {job.destinationConfig.bronzeConfig.enabled ? (
                      <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400 ml-auto" />
                    )}
                  </CardTitle>
                </CardHeader>
                {job.destinationConfig.bronzeConfig.enabled && (
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-foreground-muted">Table Name</p>
                        <p className="font-mono text-xs mt-1">{job.destinationConfig.bronzeConfig.tableName}</p>
                      </div>
                      <div>
                        <p className="text-foreground-muted">Storage Format</p>
                        <p className="font-semibold mt-1 uppercase">{job.destinationConfig.bronzeConfig.storageFormat}</p>
                      </div>
                      {job.destinationConfig.bronzeConfig.loadStrategy && (
                        <div>
                          <p className="text-foreground-muted">Load Strategy</p>
                          <p className="font-semibold mt-1 capitalize">{job.destinationConfig.bronzeConfig.loadStrategy.replace('_', ' ')}</p>
                        </div>
                      )}
                      {job.destinationConfig.bronzeConfig.auditColumns && (
                        <div className="col-span-2">
                          <p className="text-foreground-muted">Audit Columns Enabled</p>
                          <div className="flex gap-2 mt-1 flex-wrap">
                            <Badge variant="secondary">_ingested_at</Badge>
                            <Badge variant="secondary">_source_file</Badge>
                            <Badge variant="secondary">_row_number</Badge>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                )}
              </Card>

              {/* Silver Layer */}
              {job.destinationConfig.silverConfig && (
                <Card className="border-l-4 border-l-gray-400">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        S
                      </div>
                      Silver Layer
                      {job.destinationConfig.silverConfig.enabled ? (
                        <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {job.destinationConfig.silverConfig.enabled && (
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-foreground-muted">Table Name</p>
                          <p className="font-mono text-xs mt-1">{job.destinationConfig.silverConfig.tableName}</p>
                        </div>
                        <div>
                          <p className="text-foreground-muted">Storage Format</p>
                          <p className="font-semibold mt-1 uppercase">{job.destinationConfig.silverConfig.storageFormat}</p>
                        </div>
                        {job.destinationConfig.silverConfig.mergeStrategy && (
                          <div>
                            <p className="text-foreground-muted">Merge Strategy</p>
                            <p className="font-semibold mt-1 capitalize">{job.destinationConfig.silverConfig.mergeStrategy.replace('_', ' ')}</p>
                          </div>
                        )}
                        {job.destinationConfig.silverConfig.primaryKey && (
                          <div>
                            <p className="text-foreground-muted">Primary Key</p>
                            <p className="font-mono text-xs mt-1">
                              {Array.isArray(job.destinationConfig.silverConfig.primaryKey)
                                ? job.destinationConfig.silverConfig.primaryKey.join(', ')
                                : job.destinationConfig.silverConfig.primaryKey}
                            </p>
                          </div>
                        )}
                        {job.destinationConfig.silverConfig.surrogateKeyStrategy && (
                          <div>
                            <p className="text-foreground-muted">Surrogate Key Strategy</p>
                            <p className="font-semibold mt-1 capitalize">{job.destinationConfig.silverConfig.surrogateKeyStrategy.replace('_', ' ')}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Gold Layer */}
              {job.destinationConfig.goldConfig && (
                <Card className="border-l-4 border-l-yellow-500">
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                        G
                      </div>
                      Gold Layer
                      {job.destinationConfig.goldConfig.enabled ? (
                        <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-400 ml-auto" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  {job.destinationConfig.goldConfig.enabled && (
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-foreground-muted">Table Name</p>
                          <p className="font-mono text-xs mt-1">{job.destinationConfig.goldConfig.tableName}</p>
                        </div>
                        <div>
                          <p className="text-foreground-muted">Storage Format</p>
                          <p className="font-semibold mt-1 uppercase">{job.destinationConfig.goldConfig.storageFormat}</p>
                        </div>
                        {(job.destinationConfig.goldConfig.refreshStrategy || job.destinationConfig.goldConfig.buildStrategy) && (
                          <div>
                            <p className="text-foreground-muted">Build Strategy</p>
                            <p className="font-semibold mt-1 capitalize">
                              {(job.destinationConfig.goldConfig.refreshStrategy || job.destinationConfig.goldConfig.buildStrategy || '').replace('_', ' ')}
                            </p>
                          </div>
                        )}
                        {job.destinationConfig.goldConfig.compression && (
                          <div>
                            <p className="text-foreground-muted">Compression</p>
                            <p className="font-semibold mt-1 uppercase">{job.destinationConfig.goldConfig.compression}</p>
                          </div>
                        )}
                        {job.destinationConfig.goldConfig.exportEnabled && (
                          <div className="col-span-2">
                            <p className="text-foreground-muted">Export Targets</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              {job.destinationConfig.goldConfig.exportTargets?.map((target, i) => (
                                <Badge key={i} variant="secondary">{target}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}
            </div>
          </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
