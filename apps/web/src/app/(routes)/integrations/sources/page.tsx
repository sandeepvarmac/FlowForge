"use client"

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import { Input } from '@/components/ui'
import {
  Database, Plus, CheckCircle, XCircle, Loader2, Trash2, RefreshCw,
  Cloud, FileText, Globe, Code, MessageSquare, Search,
  Zap, FolderOpen, HardDrive, Pencil, Server
} from 'lucide-react'
import { DatabaseConnection } from '@/types/database-connection'
import { StorageConnection } from '@/types/storage-connection'
import { CreateConnectionModal } from '@/components/database'
import { CreateStorageConnectionModal } from '@/components/storage'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'

// Unified connection type for the list
type UnifiedConnection = {
  id: string
  name: string
  description?: string
  category: 'database' | 'storage' | 'api' | 'streaming'
  type: string
  status: 'connected' | 'failed' | 'untested'
  lastTestedAt?: number
  lastTestMessage?: string
  details: Record<string, string>
  original: DatabaseConnection | StorageConnection
}

// Source categories for tabbed navigation
const sourceCategories = [
  { id: 'all', label: 'All', icon: Globe },
  { id: 'database', label: 'Databases', icon: Database },
  { id: 'storage', label: 'Storage', icon: FolderOpen },
  { id: 'api', label: 'APIs', icon: Code },
  { id: 'streaming', label: 'Streaming', icon: Zap }
]

// Source type options for the "New Source" modal
const sourceTypeOptions = [
  {
    id: 'database',
    label: 'Database',
    description: 'SQL Server, PostgreSQL, MySQL, Oracle',
    icon: Database,
    color: 'bg-blue-50 text-blue-600',
    available: true
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Local paths, S3/MinIO buckets',
    icon: FolderOpen,
    color: 'bg-purple-50 text-purple-600',
    available: true
  },
  {
    id: 'api',
    label: 'API',
    description: 'REST APIs, webhooks, SaaS connectors',
    icon: Code,
    color: 'bg-green-50 text-green-600',
    available: false
  },
  {
    id: 'streaming',
    label: 'Streaming',
    description: 'Kafka, RabbitMQ, event streams',
    icon: Zap,
    color: 'bg-orange-50 text-orange-600',
    available: false
  }
]

// Coming Soon placeholders for each category
const comingSoonPlaceholders = {
  database: [
    { id: 'snowflake', name: 'Snowflake', description: 'Cloud data warehouse', icon: Database, color: 'blue' },
    { id: 'bigquery', name: 'Google BigQuery', description: 'Serverless data warehouse', icon: Database, color: 'green' },
    { id: 'redshift', name: 'Amazon Redshift', description: 'Cloud data warehouse', icon: Database, color: 'orange' },
    { id: 'databricks', name: 'Databricks', description: 'Unified analytics platform', icon: Database, color: 'red' }
  ],
  storage: [
    { id: 'azure-blob', name: 'Azure Blob Storage', description: 'Microsoft Azure cloud storage', icon: Cloud, color: 'blue' },
    { id: 'gcs', name: 'Google Cloud Storage', description: 'GCP storage buckets', icon: Cloud, color: 'green' },
    { id: 'sftp', name: 'SFTP / FTP', description: 'Secure file transfer servers', icon: FileText, color: 'purple' },
    { id: 'sharepoint', name: 'SharePoint', description: 'Microsoft SharePoint documents', icon: FolderOpen, color: 'blue' }
  ],
  api: [
    { id: 'rest-api', name: 'REST APIs', description: 'HTTP/REST API endpoints with authentication', icon: Globe, color: 'green' },
    { id: 'salesforce', name: 'Salesforce', description: 'CRM and Sales Cloud data', icon: Cloud, color: 'blue' },
    { id: 'hubspot', name: 'HubSpot', description: 'Marketing and CRM data', icon: Code, color: 'orange' }
  ],
  streaming: [
    { id: 'kafka', name: 'Apache Kafka', description: 'Distributed event streaming platform', icon: Zap, color: 'yellow' },
    { id: 'rabbitmq', name: 'RabbitMQ', description: 'Message broker', icon: MessageSquare, color: 'orange' },
    { id: 'kinesis', name: 'AWS Kinesis', description: 'Real-time data streaming', icon: Cloud, color: 'blue' }
  ]
}

export default function SourcesPage() {
  const router = useRouter()
  const { toasts, dismissToast, success, error: showError } = useToast()

  // Filter state
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Database connections state
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null)

  // Storage connections state
  const [storageConnections, setStorageConnections] = useState<StorageConnection[]>([])
  const [isLoadingStorage, setIsLoadingStorage] = useState(true)
  const [editingStorageConnection, setEditingStorageConnection] = useState<StorageConnection | null>(null)
  const [testingStorageId, setTestingStorageId] = useState<string | null>(null)
  const [deletingStorageId, setDeletingStorageId] = useState<string | null>(null)

  // New Source modal state
  const [showNewSourceModal, setShowNewSourceModal] = useState(false)
  const [isCreatingDb, setIsCreatingDb] = useState(false)
  const [isCreatingStorage, setIsCreatingStorage] = useState(false)

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string; type: 'database' | 'storage' } | null>(null)

  useEffect(() => {
    fetchConnections()
    fetchStorageConnections()
  }, [])

  const fetchConnections = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/database-connections')
      const data = await response.json()

      if (data.success) {
        setConnections(data.connections)
      }
    } catch (error) {
      console.error('Failed to fetch database connections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchStorageConnections = async () => {
    try {
      setIsLoadingStorage(true)
      const response = await fetch('/api/storage-connections')
      const data = await response.json()

      if (data.success) {
        setStorageConnections(data.connections)
      }
    } catch (error) {
      console.error('Failed to fetch storage connections:', error)
    } finally {
      setIsLoadingStorage(false)
    }
  }

  // Convert to unified connection list
  const unifiedConnections = useMemo((): UnifiedConnection[] => {
    const dbConnections: UnifiedConnection[] = connections.map(conn => ({
      id: conn.id,
      name: conn.name,
      description: conn.description,
      category: 'database' as const,
      type: conn.type,
      status: !conn.lastTestedAt ? 'untested' : conn.lastTestStatus === 'success' ? 'connected' : 'failed',
      lastTestedAt: conn.lastTestedAt,
      lastTestMessage: conn.lastTestMessage,
      details: {
        'Host': `${conn.host}:${conn.port}`,
        'Database': conn.database
      },
      original: conn
    }))

    const storageConns: UnifiedConnection[] = storageConnections.map(conn => {
      const config = conn.config as any
      const details: Record<string, string> = conn.type === 'local'
        ? { 'Path': config.basePath || '' }
        : { 'Bucket': config.bucket || '', 'Endpoint': config.endpointUrl || '' }
      return {
        id: conn.id,
        name: conn.name,
        description: conn.description,
        category: 'storage' as const,
        type: conn.type as string,
        status: !conn.lastTestedAt ? 'untested' : conn.lastTestStatus === 'success' ? 'connected' : 'failed',
        lastTestedAt: conn.lastTestedAt,
        lastTestMessage: conn.lastTestMessage,
        details,
        original: conn
      }
    })

    return [...dbConnections, ...storageConns]
  }, [connections, storageConnections])

  // Filter connections based on active category and search
  const filteredConnections = useMemo(() => {
    return unifiedConnections.filter(conn => {
      const matchesCategory = activeCategory === 'all' || conn.category === activeCategory
      const matchesSearch = !searchQuery ||
        conn.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conn.type.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesSearch
    })
  }, [unifiedConnections, activeCategory, searchQuery])

  // Get counts for tabs
  const getCategoryCount = (categoryId: string) => {
    if (categoryId === 'all') return unifiedConnections.length
    return unifiedConnections.filter(c => c.category === categoryId).length
  }

  const testConnection = async (connectionId: string) => {
    try {
      setTestingConnectionId(connectionId)
      const response = await fetch(`/api/database-connections/${connectionId}/test`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        await fetchConnections()
        success('Connection test successful')
      } else {
        showError(data.message || 'Connection test failed')
        await fetchConnections()
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
      showError('Failed to test connection')
    } finally {
      setTestingConnectionId(null)
    }
  }

  const testStorageConnection = async (connectionId: string) => {
    try {
      setTestingStorageId(connectionId)
      const response = await fetch(`/api/storage-connections/${connectionId}/test`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        await fetchStorageConnections()
        success('Storage connection test successful')
      } else {
        showError(data.message || 'Storage connection test failed')
        await fetchStorageConnections()
      }
    } catch (error) {
      console.error('Failed to test storage connection:', error)
      showError('Failed to test storage connection')
    } finally {
      setTestingStorageId(null)
    }
  }

  const openDeleteModal = (connectionId: string, name: string, type: 'database' | 'storage') => {
    setConnectionToDelete({ id: connectionId, name, type })
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!connectionToDelete) return

    try {
      if (connectionToDelete.type === 'database') {
        setDeletingConnectionId(connectionToDelete.id)
        const response = await fetch(`/api/database-connections/${connectionToDelete.id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          await fetchConnections()
          success('Database connection deleted')
        }
      } else {
        setDeletingStorageId(connectionToDelete.id)
        const response = await fetch(`/api/storage-connections/${connectionToDelete.id}`, {
          method: 'DELETE'
        })

        if (response.ok) {
          await fetchStorageConnections()
          success('Storage connection deleted')
        }
      }

      setDeleteModalOpen(false)
      setConnectionToDelete(null)
    } catch (error) {
      console.error('Failed to delete connection:', error)
      showError('Failed to delete connection')
    } finally {
      setDeletingConnectionId(null)
      setDeletingStorageId(null)
    }
  }

  const handleNewSourceSelect = (sourceType: string) => {
    setShowNewSourceModal(false)
    if (sourceType === 'database') {
      setIsCreatingDb(true)
    } else if (sourceType === 'storage') {
      setIsCreatingStorage(true)
    }
  }

  const getConnectionIcon = (conn: UnifiedConnection) => {
    if (conn.category === 'database') return Database
    if (conn.category === 'storage') {
      return conn.type === 's3' ? Cloud : FolderOpen
    }
    if (conn.category === 'api') return Code
    return Zap
  }

  const getConnectionIconColor = (conn: UnifiedConnection) => {
    if (conn.category === 'database') return 'bg-blue-50 text-blue-600'
    if (conn.category === 'storage') {
      return conn.type === 's3' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'
    }
    if (conn.category === 'api') return 'bg-green-50 text-green-600'
    return 'bg-yellow-50 text-yellow-600'
  }

  const getTypeLabel = (conn: UnifiedConnection) => {
    if (conn.category === 'database') {
      const labels: Record<string, string> = {
        'sql-server': 'SQL Server',
        'postgresql': 'PostgreSQL',
        'mysql': 'MySQL',
        'oracle': 'Oracle'
      }
      return labels[conn.type] || conn.type
    }
    if (conn.category === 'storage') {
      return conn.type === 's3' ? 'S3 / MinIO' : 'Local Path'
    }
    return conn.type
  }

  const getStatusBadge = (status: string) => {
    if (status === 'connected') {
      return (
        <Badge variant="success" className="text-xs flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Connected
        </Badge>
      )
    }
    if (status === 'failed') {
      return (
        <Badge variant="destructive" className="text-xs flex items-center gap-1">
          <XCircle className="w-3 h-3" />
          Failed
        </Badge>
      )
    }
    return <Badge variant="secondary" className="text-xs">Not Tested</Badge>
  }

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  const isLoadingAny = isLoading || isLoadingStorage

  // Check if we should show coming soon placeholders (for specific category tabs, not "all")
  const showComingSoonPlaceholders = activeCategory !== 'all' &&
    comingSoonPlaceholders[activeCategory as keyof typeof comingSoonPlaceholders]?.length > 0

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Sources</h1>
          <p className="text-foreground-muted mt-1">
            Connect to databases, storage, APIs, and more to ingest data into FlowForge
          </p>
        </div>
        <Button
          onClick={() => setShowNewSourceModal(true)}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Source
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 -mb-px">
          {sourceCategories.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory === category.id
            const count = getCategoryCount(category.id)

            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-3 border-b-2 transition-colors text-sm font-medium',
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-foreground-muted hover:text-foreground hover:border-border'
                )}
              >
                <Icon className="w-4 h-4" />
                {category.label}
                <span
                  className={cn(
                    "text-xs ml-1 px-1.5 py-0.5 rounded-full font-medium",
                    isActive
                      ? "bg-primary text-white"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
        <Input
          placeholder="Search connections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading State */}
      {isLoadingAny && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Connection List */}
      {!isLoadingAny && (
        <div className="space-y-3">
          {/* Empty state when no connections and no coming soon */}
          {filteredConnections.length === 0 && !showComingSoonPlaceholders && (
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <div className="flex flex-col items-center">
                {activeCategory === 'all' ? (
                  <Server className="w-10 h-10 text-muted-foreground mb-3" />
                ) : activeCategory === 'database' ? (
                  <Database className="w-10 h-10 text-muted-foreground mb-3" />
                ) : activeCategory === 'storage' ? (
                  <FolderOpen className="w-10 h-10 text-muted-foreground mb-3" />
                ) : activeCategory === 'api' ? (
                  <Code className="w-10 h-10 text-muted-foreground mb-3" />
                ) : (
                  <Zap className="w-10 h-10 text-muted-foreground mb-3" />
                )}
                <p className="text-foreground-muted text-sm mb-3">
                  {searchQuery
                    ? `No connections matching "${searchQuery}"`
                    : `No ${activeCategory === 'all' ? '' : activeCategory + ' '}connections yet`}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSourceModal(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Connection
                </Button>
              </div>
            </div>
          )}

          {/* Connection cards */}
          {filteredConnections.map((conn) => {
              const Icon = getConnectionIcon(conn)
              const iconColor = getConnectionIconColor(conn)
              const [bgClass, textClass] = iconColor.split(' ')
              const isTesting = testingConnectionId === conn.id || testingStorageId === conn.id
              const isDeleting = deletingConnectionId === conn.id || deletingStorageId === conn.id

              return (
                <Card key={conn.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={cn('p-2.5 rounded-lg', bgClass)}>
                        <Icon className={cn('w-5 h-5', textClass)} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-foreground truncate">{conn.name}</h3>
                          {getStatusBadge(conn.status)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-foreground-muted">
                          <span>{getTypeLabel(conn)}</span>
                          <span className="text-border">•</span>
                          {Object.entries(conn.details).slice(0, 2).map(([key, value], idx) => (
                            <span key={key} className="font-mono text-xs truncate max-w-[200px]" title={value}>
                              {value}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => conn.category === 'database'
                            ? testConnection(conn.id)
                            : testStorageConnection(conn.id)}
                          disabled={isTesting}
                          className="text-xs"
                        >
                          {isTesting ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <RefreshCw className="w-3 h-3 mr-1" />
                              Test
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (conn.category === 'database') {
                              setEditingConnection(conn.original as DatabaseConnection)
                            } else {
                              setEditingStorageConnection(conn.original as StorageConnection)
                            }
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDeleteModal(conn.id, conn.name, conn.category as 'database' | 'storage')}
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4 text-destructive" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {/* Error message if failed */}
                    {conn.status === 'failed' && conn.lastTestMessage && (
                      <div className="mt-3 ml-14 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                        {conn.lastTestMessage}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

          {/* Coming Soon Placeholders */}
          {showComingSoonPlaceholders && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-foreground-muted">
                <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
                <span className="text-sm">These connectors are planned for future releases</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {(comingSoonPlaceholders[activeCategory as keyof typeof comingSoonPlaceholders] || []).map((item) => {
                  const Icon = item.icon
                  const colorClasses: Record<string, string> = {
                    blue: 'bg-blue-50 text-blue-600',
                    green: 'bg-green-50 text-green-600',
                    orange: 'bg-orange-50 text-orange-600',
                    yellow: 'bg-yellow-50 text-yellow-600',
                    purple: 'bg-purple-50 text-purple-600',
                    red: 'bg-red-50 text-red-600'
                  }
                  const [bgClass, textClass] = (colorClasses[item.color] || 'bg-gray-50 text-gray-600').split(' ')

                  return (
                    <Card key={item.id} className="border-2 border-dashed opacity-60">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('p-2 rounded-lg', bgClass)}>
                            <Icon className={cn('w-5 h-5', textClass)} />
                          </div>
                          <div>
                            <h3 className="font-medium text-foreground">{item.name}</h3>
                            <p className="text-xs text-foreground-muted">{item.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Source Type Selector Modal */}
      <Dialog open={showNewSourceModal} onOpenChange={setShowNewSourceModal}>
        <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>New Data Source</DialogTitle>
            <p className="text-sm text-foreground-muted">
              Select the type of data source you want to connect
            </p>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {sourceTypeOptions.map((option) => {
              const Icon = option.icon
              const colorMap: Record<string, { bg: string; iconBg: string; text: string; border: string; hoverBorder: string }> = {
                'bg-blue-50 text-blue-600': {
                  bg: 'bg-blue-50',
                  iconBg: 'bg-blue-100',
                  text: 'text-blue-600',
                  border: 'border-blue-200',
                  hoverBorder: 'hover:border-blue-300'
                },
                'bg-purple-50 text-purple-600': {
                  bg: 'bg-purple-50',
                  iconBg: 'bg-purple-100',
                  text: 'text-purple-600',
                  border: 'border-purple-200',
                  hoverBorder: 'hover:border-purple-300'
                },
                'bg-green-50 text-green-600': {
                  bg: 'bg-green-50',
                  iconBg: 'bg-green-100',
                  text: 'text-green-600',
                  border: 'border-green-200',
                  hoverBorder: 'hover:border-green-300'
                },
                'bg-orange-50 text-orange-600': {
                  bg: 'bg-orange-50',
                  iconBg: 'bg-orange-100',
                  text: 'text-orange-600',
                  border: 'border-orange-200',
                  hoverBorder: 'hover:border-orange-300'
                }
              }
              const colors = colorMap[option.color] || colorMap['bg-blue-50 text-blue-600']

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => option.available && handleNewSourceSelect(option.id)}
                  disabled={!option.available}
                  className={cn(
                    'w-full p-4 border-2 rounded-lg text-left transition-all flex items-start gap-4',
                    option.available
                      ? `${colors.bg} ${colors.border} ${colors.hoverBorder} hover:shadow-md cursor-pointer`
                      : 'border-dashed border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                  )}
                >
                  <div className={cn('p-2 rounded-lg', colors.iconBg)}>
                    <Icon className={cn('w-5 h-5', colors.text)} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">{option.label}</h3>
                      {!option.available && (
                        <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground-muted mt-1">{option.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
          <DialogFooter>
            <div className="flex justify-end w-full">
              <Button variant="ghost" onClick={() => setShowNewSourceModal(false)}>
                Cancel
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Database Connection Modal */}
      <CreateConnectionModal
        open={isCreatingDb || editingConnection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreatingDb(false)
            setEditingConnection(null)
          }
        }}
        editConnection={editingConnection || undefined}
        onBack={() => {
          setIsCreatingDb(false)
          setShowNewSourceModal(true)
        }}
        onConnectionCreated={(connection, wasEdit) => {
          fetchConnections()
          setEditingConnection(null)
          if (wasEdit) {
            success('Database connection updated successfully')
          } else {
            success('Database connection created successfully')
          }
        }}
        onError={(message) => {
          showError(message)
        }}
      />

      {/* Create/Edit Storage Connection Modal */}
      <CreateStorageConnectionModal
        open={isCreatingStorage || editingStorageConnection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreatingStorage(false)
            setEditingStorageConnection(null)
          }
        }}
        editConnection={editingStorageConnection || undefined}
        onBack={() => {
          setIsCreatingStorage(false)
          setShowNewSourceModal(true)
        }}
        onConnectionCreated={(connection, wasEdit) => {
          fetchStorageConnections()
          setEditingStorageConnection(null)
          if (wasEdit) {
            success('Storage connection updated successfully')
          } else {
            success('Storage connection created successfully')
          }
        }}
        onError={(message) => {
          showError(message)
        }}
      />

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Delete Connection Modal */}
      <DeleteConfirmationModal
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        onConfirm={handleDeleteConfirm}
        title={connectionToDelete?.type === 'storage' ? 'Delete Storage Connection' : 'Delete Database Connection'}
        description="Are you sure you want to delete this connection? This action cannot be undone."
        itemName={connectionToDelete?.name || ''}
        itemType="connection"
        isDeleting={deletingConnectionId === connectionToDelete?.id || deletingStorageId === connectionToDelete?.id}
      />
    </div>
  )
}
