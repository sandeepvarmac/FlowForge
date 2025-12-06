'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Database,
  Plus,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Table2,
  Eye,
  Server,
  Layers,
  FileCode,
  Search,
  FolderOpen,
  Code2,
  Braces
} from 'lucide-react'
import { DataAssetsLayout } from '@/components/data-assets'
import { DatabaseConnection } from '@/types/database-connection'
import { cn } from '@/lib/utils'

interface TableInfo {
  name: string
  schema?: string
  row_count?: number
}

interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
}

interface TablePreview {
  schema: ColumnSchema[]
  rows: any[]
  total_rows?: number
  row_count?: number
}

interface TreeNode {
  id: string
  label: string
  type: 'connection' | 'database' | 'schema' | 'folder' | 'table' | 'view' | 'procedure' | 'function'
  icon: React.ElementType
  children?: TreeNode[]
  isExpanded?: boolean
  connectionId?: string
  databaseName?: string
  schemaName?: string
  folderType?: 'tables' | 'views' | 'procedures' | 'functions'
  tableName?: string
}

export default function SourceDataPage() {
  const router = useRouter()

  // Connections state
  const [connections, setConnections] = React.useState<DatabaseConnection[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Tree navigation state
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = React.useState<TreeNode | null>(null)
  const [searchQuery, setSearchQuery] = React.useState('')

  // Table data state
  const [tables, setTables] = React.useState<Record<string, TableInfo[]>>({})
  const [isLoadingTables, setIsLoadingTables] = React.useState<Record<string, boolean>>({})

  // Preview state
  const [tablePreview, setTablePreview] = React.useState<TablePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchConnections()
  }, [])

  // Eagerly load tables when search query is active
  React.useEffect(() => {
    if (searchQuery.trim() && connections.length > 0) {
      connections
        .filter(conn => conn.lastTestStatus === 'success')
        .forEach(conn => {
          fetchTables(conn.id)
        })
    }
  }, [searchQuery, connections])

  const fetchConnections = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/database-connections')
      const data = await response.json()

      if (data.success) {
        setConnections(data.connections || [])
      } else {
        setError('Failed to load connections')
      }
    } catch (err) {
      setError('Failed to fetch database connections')
      console.error('Error fetching connections:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTables = async (connectionId: string) => {
    const cacheKey = connectionId

    if (tables[cacheKey]) {
      return tables[cacheKey]
    }

    try {
      setIsLoadingTables(prev => ({ ...prev, [cacheKey]: true }))
      const response = await fetch(`/api/database-connections/${connectionId}/tables`)
      const data = await response.json()

      if (data.success) {
        const tablesList = data.tables?.map((name: string) => ({ name })) || []
        setTables(prev => ({ ...prev, [cacheKey]: tablesList }))
        return tablesList
      }
      return []
    } catch (error) {
      console.error('Error fetching tables:', error)
      return []
    } finally {
      setIsLoadingTables(prev => ({ ...prev, [cacheKey]: false }))
    }
  }

  const buildTreeNodes = (): TreeNode[] => {
    return connections
      .filter(conn => conn.lastTestStatus === 'success')
      .map((connection) => {
        const connectionNode: TreeNode = {
          id: `conn-${connection.id}`,
          label: connection.name,
          type: 'connection',
          icon: Database,
          connectionId: connection.id,
          children: [
            {
              id: `db-${connection.id}-${connection.database}`,
              label: connection.database || 'default',
              type: 'database',
              icon: Server,
              connectionId: connection.id,
              databaseName: connection.database,
              children: [
                {
                  id: `schema-${connection.id}-${connection.database}-public`,
                  label: 'public',
                  type: 'schema',
                  icon: Layers,
                  connectionId: connection.id,
                  databaseName: connection.database,
                  schemaName: 'public',
                  children: [
                    {
                      id: `folder-${connection.id}-tables`,
                      label: 'Tables',
                      type: 'folder',
                      icon: FolderOpen,
                      connectionId: connection.id,
                      folderType: 'tables',
                      children: [] // Tables will be loaded dynamically
                    },
                    {
                      id: `folder-${connection.id}-views`,
                      label: 'Views',
                      type: 'folder',
                      icon: Eye,
                      connectionId: connection.id,
                      folderType: 'views',
                      children: []
                    },
                    {
                      id: `folder-${connection.id}-procedures`,
                      label: 'Stored Procedures',
                      type: 'folder',
                      icon: Code2,
                      connectionId: connection.id,
                      folderType: 'procedures',
                      children: []
                    },
                    {
                      id: `folder-${connection.id}-functions`,
                      label: 'Functions',
                      type: 'folder',
                      icon: Braces,
                      connectionId: connection.id,
                      folderType: 'functions',
                      children: []
                    }
                  ]
                }
              ]
            }
          ]
        }
        return connectionNode
      })
  }

  const toggleNode = async (node: TreeNode) => {
    const nodeId = node.id
    const isExpanded = expandedNodes.has(nodeId)

    if (isExpanded) {
      setExpandedNodes(prev => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    } else {
      setExpandedNodes(prev => new Set(prev).add(nodeId))

      // Load tables when expanding Tables folder
      if (node.type === 'folder' && node.folderType === 'tables' && node.connectionId) {
        const tablesList = await fetchTables(node.connectionId)

        // Update tree to include table nodes
        if (tablesList.length > 0) {
          // Tables are now cached, re-render will show them
        }
      }
    }
  }

  const handleNodeSelect = async (node: TreeNode) => {
    setSelectedNode(node)
    setPreviewError(null)
    setTablePreview(null)

    // Load table preview if it's a table node
    if (node.type === 'table' && node.connectionId && node.tableName) {
      setIsLoadingPreview(true)
      try {
        const response = await fetch(
          `/api/database-connections/${node.connectionId}/tables/${node.tableName}?action=preview&limit=100`
        )
        const data = await response.json()

        if (data.success) {
          setTablePreview({
            schema: data.schema || [],
            rows: data.rows || [],
            total_rows: data.total_rows,
            row_count: data.row_count
          })
        } else {
          setPreviewError(data.error || 'Failed to load preview')
        }
      } catch (error) {
        setPreviewError('Failed to fetch table preview')
      } finally {
        setIsLoadingPreview(false)
      }
    }
  }

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    // Use node.isExpanded from filtered tree (for auto-expand during search) or expandedNodes Set
    const isExpanded = node.isExpanded || expandedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id
    const Icon = node.icon
    const hasChildren = node.children && node.children.length > 0
    const isLoadingNode = node.type === 'folder' && node.folderType === 'tables' && isLoadingTables[node.connectionId || '']

    // Get tables for Tables folder nodes
    let childNodes = node.children || []
    if (node.type === 'folder' && node.folderType === 'tables' && node.connectionId && isExpanded) {
      const tablesList = tables[node.connectionId] || []
      if (tablesList.length > 0 && childNodes.length === 0) {
        childNodes = tablesList.map(table => ({
          id: `table-${node.connectionId}-${table.name}`,
          label: table.name,
          type: 'table' as const,
          icon: Table2,
          connectionId: node.connectionId,
          tableName: table.name
        }))
      }
    }

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            handleNodeSelect(node)
            if (hasChildren || node.type === 'folder') {
              toggleNode(node)
            }
          }}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors',
            'hover:bg-gray-100',
            isSelected
              ? 'bg-primary/10 text-primary border-l-2 border-primary'
              : 'text-foreground'
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
        >
          {(hasChildren || node.type === 'folder') && (
            <span className="flex-shrink-0">
              {isLoadingNode ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </span>
          )}
          {!(hasChildren || node.type === 'folder') && (
            <span className="w-4" />
          )}
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate font-medium">{node.label}</span>
          {node.type === 'table' && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Table
            </Badge>
          )}
        </button>

        {isExpanded && childNodes.length > 0 && (
          <div>
            {childNodes.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  const handleAddToJob = () => {
    if (!selectedNode || selectedNode.type !== 'table') return

    const connection = connections.find(c => c.id === selectedNode.connectionId)
    if (!connection) return

    sessionStorage.setItem('preselectedSource', JSON.stringify({
      connectionId: selectedNode.connectionId,
      connectionName: connection.name,
      tableName: selectedNode.tableName,
      databaseType: connection.type
    }))

    router.push('/workflows')
  }

  const filteredTreeNodes = React.useMemo(() => {
    const nodes = buildTreeNodes()
    if (!searchQuery.trim()) return nodes

    const query = searchQuery.toLowerCase()

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map(node => {
          const matchesSearch = node.label.toLowerCase().includes(query)

          // For Tables folders, include table nodes in search even if not expanded
          let childrenToFilter = node.children || []
          if (node.type === 'folder' && node.folderType === 'tables' && node.connectionId) {
            const tablesList = tables[node.connectionId] || []
            if (tablesList.length > 0) {
              childrenToFilter = tablesList.map(table => ({
                id: `table-${node.connectionId}-${table.name}`,
                label: table.name,
                type: 'table' as const,
                icon: Table2,
                connectionId: node.connectionId,
                tableName: table.name
              }))
            }
          }

          const filteredChildren = childrenToFilter.length > 0 ? filterNodes(childrenToFilter) : []

          if (matchesSearch || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren.length > 0 ? filteredChildren : node.children,
              // Auto-expand folders that have matching children
              isExpanded: filteredChildren.length > 0 ? true : node.isExpanded
            }
          }
          return null
        })
        .filter((node): node is TreeNode => node !== null)
    }

    return filterNodes(nodes)
  }, [connections, searchQuery, tables])

  const renderMainPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Database Explorer
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a connection, database, schema, or table from the tree view to explore your data.
            </p>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'connection') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <Database className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{connection.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {connection.type === 'sql-server' ? 'SQL Server' :
                   connection.type === 'postgresql' ? 'PostgreSQL' :
                   connection.type === 'mysql' ? 'MySQL' : 'Oracle'}
                </p>
              </div>
              <Badge variant="success" className="ml-auto">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            </div>

            {connection.description && (
              <p className="text-muted-foreground mb-6">{connection.description}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Host</p>
                <p className="font-mono text-sm text-foreground">{connection.host}:{connection.port}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Database</p>
                <p className="font-mono text-sm text-foreground">{connection.database}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Username</p>
                <p className="font-mono text-sm text-foreground">{connection.username}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Last Tested</p>
                <p className="text-sm text-foreground">
                  {connection.lastTestedAt
                    ? new Date(connection.lastTestedAt).toLocaleString()
                    : 'Never'}
                </p>
              </div>
            </div>

            <Button
              onClick={() => router.push('/integrations/sources')}
              variant="outline"
            >
              Manage Connection
            </Button>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'database') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <Server className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{selectedNode.label}</h2>
                <p className="text-sm text-muted-foreground">Database</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connection</p>
                <p className="font-medium text-sm text-foreground">{connection.name}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Database Type</p>
                <p className="font-medium text-sm text-foreground">
                  {connection.type === 'sql-server' ? 'SQL Server' :
                   connection.type === 'postgresql' ? 'PostgreSQL' :
                   connection.type === 'mysql' ? 'MySQL' : 'Oracle'}
                </p>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Database Objects</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Schemas</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">1</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Expand the database in the tree to explore schemas and their objects.
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'schema') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      // Get table count from cached tables
      const tableCount = tables[selectedNode.connectionId || '']?.length || 0

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <Layers className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{selectedNode.label}</h2>
                <p className="text-sm text-muted-foreground">Schema in {selectedNode.databaseName}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connection</p>
                <p className="font-medium text-sm text-foreground">{connection.name}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Database</p>
                <p className="font-medium text-sm text-foreground">{selectedNode.databaseName}</p>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Schema Objects</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Tables</span>
                  </div>
                  {tableCount > 0 ? (
                    <span className="text-sm font-medium text-foreground">{tableCount}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not loaded</span>
                  )}
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Views</span>
                  </div>
                  <span className="text-xs text-muted-foreground italic">Coming soon</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Stored Procedures</span>
                  </div>
                  <span className="text-xs text-muted-foreground italic">Coming soon</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <Braces className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Functions</span>
                  </div>
                  <span className="text-xs text-muted-foreground italic">Coming soon</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Expand the schema in the tree to explore these object types.
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'folder') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      const folderLabels = {
        tables: 'Tables',
        views: 'Views',
        procedures: 'Stored Procedures',
        functions: 'Functions'
      }
      const folderIcons = {
        tables: Table2,
        views: Eye,
        procedures: Code2,
        functions: Braces
      }
      const FolderIcon = selectedNode.folderType ? folderIcons[selectedNode.folderType] : FolderOpen
      const folderLabel = selectedNode.folderType ? folderLabels[selectedNode.folderType] : selectedNode.label

      // Get count for tables folder
      const tableCount = selectedNode.folderType === 'tables' && selectedNode.connectionId
        ? tables[selectedNode.connectionId]?.length || 0
        : 0

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <FolderIcon className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{folderLabel}</h2>
                <p className="text-sm text-muted-foreground">Schema Objects</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connection</p>
                <p className="font-medium text-sm text-foreground">{connection.name}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Schema</p>
                <p className="font-medium text-sm text-foreground">public</p>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Object Count</h3>
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
                <div className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-base text-foreground">{folderLabel}</span>
                </div>
                {selectedNode.folderType === 'tables' ? (
                  tableCount > 0 ? (
                    <span className="text-xl font-semibold text-primary">{tableCount}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not loaded</span>
                  )
                ) : (
                  <span className="text-sm text-muted-foreground italic">Coming soon</span>
                )}
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                {selectedNode.folderType === 'tables' ? 'Explore Tables' : 'Coming Soon'}
              </h3>
              <p className="text-sm text-blue-700">
                {selectedNode.folderType === 'tables'
                  ? 'Expand this folder in the tree to view all tables. Click on any table to preview its schema and data.'
                  : selectedNode.folderType === 'views'
                  ? 'View support will be added in a future release. Views allow you to create virtual tables based on queries.'
                  : selectedNode.folderType === 'procedures'
                  ? 'Stored procedure support will be added in a future release. Execute and manage database procedures.'
                  : 'Function support will be added in a future release. Browse and execute database functions.'}
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'table') {
      if (isLoadingPreview) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        )
      }

      if (previewError) {
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-lg font-semibold mb-2">Preview Failed</h2>
              <p className="text-sm text-muted-foreground">{previewError}</p>
            </div>
          </div>
        )
      }

      if (tablePreview) {
        return (
          <div className="h-full flex flex-col min-h-0">
            {/* Table Header */}
            <div className="border-b bg-card p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedNode.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {tablePreview.schema.length} columns • {tablePreview.total_rows?.toLocaleString() || 'Unknown'} total rows
                  </p>
                </div>
                <Button onClick={handleAddToJob} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add to Job
                </Button>
              </div>
            </div>

            {/* Tabs: Schema, DDL, Preview, Dependencies */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <Tabs defaultValue="schema" className="h-full flex flex-col min-h-0 overflow-hidden">
                <div className="border-b px-4 flex-shrink-0">
                  <TabsList className="bg-transparent h-auto p-0">
                    <TabsTrigger value="schema" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      Schema ({tablePreview.schema.length} columns)
                    </TabsTrigger>
                    <TabsTrigger value="ddl" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      DDL
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      Preview (first 100 rows)
                    </TabsTrigger>
                    <TabsTrigger value="dependencies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      Dependencies
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Schema Tab */}
                <TabsContent value="schema" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                  <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                    <div className="overflow-auto flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-20 bg-primary text-white shadow-md border-b border-primary-700">
                          <tr>
                            <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Column Name</th>
                            <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Data Type</th>
                            <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Nullable</th>
                            <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tablePreview.schema.map((col, idx) => {
                            // Simple heuristic to detect primary/foreign keys
                            const isPK = col.name.toLowerCase() === 'id' || col.name.toLowerCase().endsWith('_id') && idx === 0
                            const isFK = col.name.toLowerCase().endsWith('_id') && idx !== 0

                            return (
                              <tr key={idx} className="border-b border-primary-100 hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                                <td className="p-3 font-mono text-foreground">
                                  {col.name}
                                  {isPK && <span className="ml-2 text-xs text-blue-600 font-semibold">(PK)</span>}
                                  {isFK && <span className="ml-2 text-xs text-purple-600 font-semibold">(FK)</span>}
                                </td>
                                <td className="p-3 text-muted-foreground">{col.type}</td>
                                <td className="p-3">
                                  <Badge variant={col.nullable ? 'secondary' : 'outline'} className="text-xs">
                                    {col.nullable ? 'Yes' : 'No'}
                                  </Badge>
                                </td>
                                <td className="p-3 text-muted-foreground text-xs">
                                  {isPK && 'Primary Key'}
                                  {isFK && 'Foreign Key'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                {/* DDL Tab */}
                <TabsContent value="ddl" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                  <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                    <div className="overflow-auto flex-1 min-h-0 p-4 bg-muted/30">
                      <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">
                        {`CREATE TABLE ${selectedNode.tableName} (\n${tablePreview.schema.map((col, idx) => {
                          const isPK = col.name.toLowerCase() === 'id' || (col.name.toLowerCase().endsWith('_id') && idx === 0)
                          return `  ${col.name} ${col.type}${col.nullable ? '' : ' NOT NULL'}${isPK ? ' PRIMARY KEY' : ''}`
                        }).join(',\n')}\n);`}
                      </pre>
                    </div>
                    <div className="px-4 py-2 border-t bg-card flex-shrink-0">
                      <p className="text-xs text-muted-foreground">
                        Note: This is a simplified DDL representation. Actual constraints and indexes may differ.
                      </p>
                    </div>
                  </div>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                  <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                    <div className="px-4 py-2 border-b bg-muted/30 text-foreground flex-shrink-0">
                      <p className="text-sm text-muted-foreground">
                        Showing first {Math.min(100, tablePreview.rows.length)} of {tablePreview.total_rows?.toLocaleString() || 'Unknown'} total rows
                      </p>
                    </div>
                    <div className="overflow-auto flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-20 bg-primary text-white shadow-md border-b border-primary-700">
                          <tr>
                            {tablePreview.schema.map((col) => (
                              <th key={col.name} className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent whitespace-nowrap">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tablePreview.rows.map((row, idx) => (
                            <tr key={idx} className="border-b border-primary-100 hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                              {tablePreview.schema.map((col) => (
                                <td key={col.name} className="p-3 text-foreground whitespace-nowrap">
                                  {row[col.name] !== null && row[col.name] !== undefined
                                    ? String(row[col.name])
                                    : <span className="text-muted-foreground/50 italic">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                {/* Dependencies Tab */}
                <TabsContent value="dependencies" className="flex-1 min-h-0 m-0 p-4 overflow-auto data-[state=inactive]:hidden">
                  <div className="space-y-4">
                    {/* Referenced By (Views/Procedures that use this table) */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Referenced By
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Views, stored procedures, or functions that reference this table
                      </p>
                      <div className="text-center py-8 text-sm text-muted-foreground">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No dependencies detected</p>
                        <p className="text-xs mt-1">This feature requires database metadata analysis</p>
                      </div>
                    </div>

                    {/* References (Tables this table depends on) */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Table2 className="w-4 h-4" />
                        References
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Tables referenced through foreign key relationships
                      </p>
                      {tablePreview.schema.filter(col =>
                        col.name.toLowerCase().endsWith('_id') &&
                        col.name.toLowerCase() !== 'id'
                      ).length > 0 ? (
                        <div className="space-y-2">
                          {tablePreview.schema
                            .filter(col => col.name.toLowerCase().endsWith('_id') && col.name.toLowerCase() !== 'id')
                            .map((col) => {
                              const referencedTable = col.name.toLowerCase().replace('_id', '')
                              return (
                                <div key={col.name} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                                  <Table2 className="w-4 h-4 text-muted-foreground" />
                                  <span className="font-mono text-foreground">{col.name}</span>
                                  <span className="text-muted-foreground">→</span>
                                  <span className="font-mono text-foreground">{referencedTable}</span>
                                  <Badge variant="outline" className="ml-auto text-xs">Inferred</Badge>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          <p>No foreign key relationships detected</p>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )
      }
    }

    return null
  }

  return (
    <DataAssetsLayout>
      <div className="h-full flex overflow-hidden bg-background min-h-0">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center w-full h-full">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-sm text-muted-foreground">Loading connections...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex items-center justify-center w-full h-full p-6">
            <div className="text-center max-w-md">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-lg font-semibold text-foreground mb-2">Error Loading Connections</h2>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={fetchConnections} variant="outline">
                Retry
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && connections.length === 0 && (
          <div className="flex items-center justify-center w-full h-full p-6">
            <div className="text-center max-w-md">
              <Database className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No Database Connections
              </h2>
              <p className="text-muted-foreground mb-6">
                Create your first database connection to start exploring source data.
                Connect to PostgreSQL, SQL Server, MySQL, or Oracle databases.
              </p>
              <Button
                onClick={() => router.push('/integrations/sources')}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create Connection
              </Button>
            </div>
          </div>
        )}

        {/* Main Content - Tree View + Detail Panel */}
        {!isLoading && !error && connections.length > 0 && (
          <>
            {/* Left Panel - Tree Navigation */}
            <div className="w-80 border-r bg-card flex flex-col">
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Database Explorer</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => router.push('/integrations/sources')}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {filteredTreeNodes.length === 0 ? (
                  <div className="text-center py-8 px-4">
                    <p className="text-sm text-muted-foreground">
                      {searchQuery ? 'No matching items found' : 'No connected databases'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredTreeNodes.map(node => renderTreeNode(node))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-muted/30">
                <div className="text-xs text-muted-foreground">
                  {connections.filter(c => c.lastTestStatus === 'success').length} active {connections.filter(c => c.lastTestStatus === 'success').length === 1 ? 'connection' : 'connections'}
                </div>
              </div>
            </div>

            {/* Right Panel - Details */}
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {renderMainPanel()}
            </div>
          </>
        )}
      </div>
    </DataAssetsLayout>
  )
}
