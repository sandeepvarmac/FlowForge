"use client"

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui'
import {
  Database, Plus, CheckCircle, XCircle, Loader2, Trash2, RefreshCw,
  Cloud, FileText, Globe, Code, Mail, ShoppingCart, MessageSquare,
  Calendar, Zap, FolderOpen, HardDrive, Pencil
} from 'lucide-react'
import { DatabaseConnection } from '@/types/database-connection'
import { CreateConnectionModal } from '@/components/database'
import { DeleteConfirmationModal } from '@/components/common/delete-confirmation-modal'
import { ToastContainer } from '@/components/ui/toast-container'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

// Source categories for tabbed navigation
const sourceCategories = [
  { id: 'all', label: 'All Sources', icon: Globe },
  { id: 'databases', label: 'Databases', icon: Database, count: 0 },
  { id: 'files', label: 'Files & Storage', icon: FolderOpen, count: 0 },
  { id: 'apis', label: 'APIs & Services', icon: Code, count: 0 },
  { id: 'streaming', label: 'Streaming', icon: Zap, count: 0 }
]

// Coming Soon Integrations organized by category
const comingSoonIntegrations = {
  files: [
    {
      id: 'file-shares',
      name: 'Network File Shares',
      description: 'Windows shares, NFS, SMB/CIFS mounted drives',
      icon: HardDrive,
      color: 'purple',
      status: 'planned'
    },
    {
      id: 'ftp-sftp',
      name: 'FTP/SFTP',
      description: 'File transfer protocol servers',
      icon: FileText,
      color: 'blue',
      status: 'planned'
    },
    {
      id: 'cloud-storage',
      name: 'Cloud Storage',
      description: 'Amazon S3, Azure Blob, Google Cloud Storage',
      icon: Cloud,
      color: 'blue',
      status: 'planned'
    }
  ],
  apis: [
    {
      id: 'rest-api',
      name: 'REST APIs',
      description: 'HTTP/REST API endpoints with authentication',
      icon: Globe,
      color: 'green',
      status: 'planned'
    },
    {
      id: 'crm',
      name: 'CRM Systems',
      description: 'Salesforce, HubSpot, Dynamics 365',
      icon: ShoppingCart,
      color: 'orange',
      status: 'planned'
    },
    {
      id: 'analytics',
      name: 'Analytics Platforms',
      description: 'Google Analytics, Adobe Analytics',
      icon: Zap,
      color: 'pink',
      status: 'planned'
    }
  ],
  streaming: [
    {
      id: 'messaging',
      name: 'Message Queues',
      description: 'Kafka, RabbitMQ, Azure Service Bus',
      icon: MessageSquare,
      color: 'yellow',
      status: 'planned'
    }
  ]
}

export default function SourcesPage() {
  const { toasts, dismissToast, success, error: showError } = useToast()
  const [activeCategory, setActiveCategory] = useState('all')
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [editingConnection, setEditingConnection] = useState<DatabaseConnection | null>(null)
  const [testingConnectionId, setTestingConnectionId] = useState<string | null>(null)
  const [deletingConnectionId, setDeletingConnectionId] = useState<string | null>(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [connectionToDelete, setConnectionToDelete] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    fetchConnections()
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
      console.error('Failed to fetch connections:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async (connectionId: string) => {
    try {
      setTestingConnectionId(connectionId)
      const response = await fetch(`/api/database-connections/${connectionId}/test`, {
        method: 'POST'
      })
      const data = await response.json()

      if (data.success) {
        // Refresh connections to show updated test status
        await fetchConnections()
      }
    } catch (error) {
      console.error('Failed to test connection:', error)
    } finally {
      setTestingConnectionId(null)
    }
  }

  const openDeleteModal = (connectionId: string, name: string) => {
    setConnectionToDelete({ id: connectionId, name })
    setDeleteModalOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!connectionToDelete) return

    try {
      setDeletingConnectionId(connectionToDelete.id)
      const response = await fetch(`/api/database-connections/${connectionToDelete.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await fetchConnections()
        setDeleteModalOpen(false)
        setConnectionToDelete(null)
      }
    } catch (error) {
      console.error('Failed to delete connection:', error)
      throw error
    } finally {
      setDeletingConnectionId(null)
    }
  }

  const getDatabaseIcon = (type: string) => {
    return Database
  }

  const getStatusBadge = (connection: DatabaseConnection) => {
    if (!connection.lastTestedAt) {
      return <Badge variant="secondary" className="text-xs">Not Tested</Badge>
    }

    if (connection.lastTestStatus === 'success') {
      return (
        <Badge variant="success" className="text-xs flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Connected
        </Badge>
      )
    }

    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Failed
      </Badge>
    )
  }

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleString()
  }

  // Filter coming soon integrations based on active category
  const getFilteredComingSoon = () => {
    if (activeCategory === 'all') {
      return [...comingSoonIntegrations.files, ...comingSoonIntegrations.apis, ...comingSoonIntegrations.streaming]
    }
    if (activeCategory === 'databases') {
      return []
    }
    return comingSoonIntegrations[activeCategory as keyof typeof comingSoonIntegrations] || []
  }

  const showDatabases = activeCategory === 'all' || activeCategory === 'databases'
  const showComingSoon = activeCategory === 'all' || activeCategory !== 'databases'

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Data Sources</h1>
          <p className="text-foreground-muted mt-1">
            Connect to databases, cloud storage, APIs, and more to ingest data into FlowForge
          </p>
        </div>
        {showDatabases && (
          <Button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Database Connection
          </Button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 -mb-px">
          {sourceCategories.map((category) => {
            const Icon = category.icon
            const isActive = activeCategory === category.id
            const count = category.id === 'databases' ? connections.length : 0

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
                {count > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">
                    {count}
                  </Badge>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Database Connections Section */}
      {showDatabases && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Database Connections</h2>
              <p className="text-sm text-foreground-muted mt-0.5">
                SQL Server, PostgreSQL, MySQL, and Oracle databases
              </p>
            </div>
            <Badge variant="success" className="text-xs">Available Now</Badge>
          </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Empty State */}
      {!isLoading && connections.length === 0 && (
        <Card className="border-2 border-dashed">
          <CardContent className="p-12 text-center">
            <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">No Database Connections</h2>
            <p className="text-foreground-muted mb-6 max-w-md mx-auto">
              Create your first database connection to start ingesting data from SQL Server, PostgreSQL, MySQL, or Oracle databases.
            </p>
            <Button onClick={() => setIsCreating(true)} className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Connection
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Connections Grid */}
      {!isLoading && connections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {connections.map((connection) => {
            const Icon = getDatabaseIcon(connection.type)
            const isTesting = testingConnectionId === connection.id
            const isDeleting = deletingConnectionId === connection.id

            return (
              <Card key={connection.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary-50">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{connection.name}</CardTitle>
                        <p className="text-xs text-foreground-muted mt-0.5">
                          {connection.type === 'sql-server' ? 'SQL Server' :
                           connection.type === 'postgresql' ? 'PostgreSQL' :
                           connection.type === 'mysql' ? 'MySQL' :
                           'Oracle'}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(connection)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {connection.description && (
                    <p className="text-sm text-foreground-muted">{connection.description}</p>
                  )}

                  <div className="text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Host:</span>
                      <span className="font-mono text-foreground">{connection.host}:{connection.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Database:</span>
                      <span className="font-mono text-foreground">{connection.database}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Last Tested:</span>
                      <span className="text-foreground">{formatTimestamp(connection.lastTestedAt)}</span>
                    </div>
                  </div>

                  {connection.lastTestStatus === 'failed' && connection.lastTestMessage && (
                    <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      {connection.lastTestMessage}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                      onClick={() => testConnection(connection.id)}
                      disabled={isTesting}
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Testing...
                        </>
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
                      onClick={() => setEditingConnection(connection)}
                      title="Edit connection"
                    >
                      <Pencil className="w-3 h-3 text-primary" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDeleteModal(connection.id, connection.name)}
                      disabled={isDeleting}
                      title="Delete connection"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3 text-destructive" />
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Stats Card */}
      {!isLoading && connections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connection Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-2xl font-bold text-foreground">{connections.length}</div>
                <div className="text-xs text-foreground-muted">Total Connections</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {connections.filter(c => c.lastTestStatus === 'success').length}
                </div>
                <div className="text-xs text-foreground-muted">Active</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-600">
                  {connections.filter(c => c.lastTestStatus === 'failed').length}
                </div>
                <div className="text-xs text-foreground-muted">Failed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-600">
                  {connections.filter(c => !c.lastTestedAt).length}
                </div>
                <div className="text-xs text-foreground-muted">Not Tested</div>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        </div>
      )}

      {/* Coming Soon Integrations */}
      {showComingSoon && getFilteredComingSoon().length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                {activeCategory === 'all' ? 'More Integrations' :
                 activeCategory === 'files' ? 'File & Storage Connectors' :
                 activeCategory === 'apis' ? 'API & Service Connectors' :
                 'Streaming Connectors'}
              </h2>
              <p className="text-sm text-foreground-muted mt-0.5">
                {activeCategory === 'all'
                  ? 'Additional data source connectors coming soon'
                  : 'These connectors are planned for future releases'}
              </p>
            </div>
            <Badge variant="secondary" className="text-xs">Coming Soon</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getFilteredComingSoon().map((integration) => {
              const Icon = integration.icon

              // Color mapping for proper Tailwind classes
              const colorClasses = {
                blue: 'bg-blue-50 text-blue-600',
                green: 'bg-green-50 text-green-600',
                purple: 'bg-purple-50 text-purple-600',
                yellow: 'bg-yellow-50 text-yellow-600',
                orange: 'bg-orange-50 text-orange-600',
                pink: 'bg-pink-50 text-pink-600'
              }[integration.color] || 'bg-gray-50 text-gray-600'

              const [bgClass, textClass] = colorClasses.split(' ')

              return (
                <Card key={integration.id} className="border-2 border-dashed opacity-75 hover:opacity-100 transition-opacity">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${bgClass}`}>
                          <Icon className={`w-5 h-5 ${textClass}`} />
                        </div>
                        <div>
                          <CardTitle className="text-base">{integration.name}</CardTitle>
                          <p className="text-xs text-foreground-muted mt-0.5">
                            {integration.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Badge variant="secondary" className="text-xs">Coming in Q2 2025</Badge>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Create/Edit Connection Modal */}
      <CreateConnectionModal
        open={isCreating || editingConnection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreating(false)
            setEditingConnection(null)
          }
        }}
        editConnection={editingConnection || undefined}
        onConnectionCreated={(connection, wasEdit) => {
          fetchConnections()
          setEditingConnection(null)
          if (wasEdit) {
            success('Connection updated successfully')
          } else {
            success('Connection created successfully')
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
        title="Delete Database Connection"
        description="Are you sure you want to delete this database connection? This action cannot be undone."
        itemName={connectionToDelete?.name || ''}
        itemType="connection"
        isDeleting={deletingConnectionId === connectionToDelete?.id}
      />
    </div>
  )
}
