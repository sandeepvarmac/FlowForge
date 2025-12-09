'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  HardDrive,
  Plus,
  CheckCircle,
  Loader2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  FileText,
  Search,
  FolderOpen,
  Folder,
  FileSpreadsheet,
  FileJson,
  File,
  Clock,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface StorageConnection {
  id: string
  name: string
  type: 'local' | 's3'
  description?: string
  lastTestStatus?: string
  lastTestedAt?: string
  config: any
}

interface StorageFile {
  name: string
  path: string
  size: number
  lastModified: number
  isDirectory: boolean
}

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  sample?: string
}

interface FilePreview {
  success: boolean
  error?: string
  schema?: SchemaColumn[]
  preview?: Record<string, any>[]
  metadata?: {
    rowCount: number
    fileSize: number
    hasHeader: boolean
    temporal_columns?: string[]
    pk_candidates?: string[]
  }
}

interface TreeNode {
  id: string
  label: string
  type: 'connection' | 'folder' | 'file'
  icon: React.ElementType
  children?: TreeNode[]
  isExpanded?: boolean
  connectionId?: string
  filePath?: string
  fileSize?: number
  isDirectory?: boolean
}

interface SourceStorageViewProps {
  searchTerm?: string
}

export function SourceStorageView({ searchTerm = '' }: SourceStorageViewProps) {
  const router = useRouter()

  // Connections state
  const [connections, setConnections] = React.useState<StorageConnection[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Tree navigation state
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(new Set())
  const [selectedNode, setSelectedNode] = React.useState<TreeNode | null>(null)
  const [searchQuery, setSearchQuery] = React.useState(searchTerm)

  // Files state (cached by connection+path)
  const [files, setFiles] = React.useState<Record<string, StorageFile[]>>({})
  const [isLoadingFiles, setIsLoadingFiles] = React.useState<Record<string, boolean>>({})

  // Preview state
  const [filePreview, setFilePreview] = React.useState<FilePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetchConnections()
  }, [])

  // Helper to check if connection is usable (success or never tested)
  const isConnectionUsable = (conn: StorageConnection) =>
    conn.lastTestStatus === 'success' || !conn.lastTestStatus

  // Eagerly load files when search query is active
  React.useEffect(() => {
    if (searchQuery.trim() && connections.length > 0) {
      connections
        .filter(isConnectionUsable)
        .forEach(conn => {
          fetchFiles(conn.id, '')
        })
    }
  }, [searchQuery, connections])

  const fetchConnections = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/storage-connections')
      const data = await response.json()

      if (data.success) {
        setConnections(data.connections || [])
      } else {
        setError('Failed to load connections')
      }
    } catch (err) {
      setError('Failed to fetch storage connections')
      console.error('Error fetching connections:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const fetchFiles = async (connectionId: string, prefix: string) => {
    const cacheKey = `${connectionId}:${prefix}`

    if (files[cacheKey]) {
      return files[cacheKey]
    }

    try {
      setIsLoadingFiles(prev => ({ ...prev, [cacheKey]: true }))
      const response = await fetch(
        `/api/storage-connections/${connectionId}/files?prefix=${encodeURIComponent(prefix)}&pattern=*.csv,*.json,*.parquet,*.xlsx,*.xls`
      )
      const data = await response.json()

      if (data.success) {
        const filesList = data.files || []
        setFiles(prev => ({ ...prev, [cacheKey]: filesList }))
        return filesList
      }
      return []
    } catch (error) {
      console.error('Error fetching files:', error)
      return []
    } finally {
      setIsLoadingFiles(prev => ({ ...prev, [cacheKey]: false }))
    }
  }

  const getFileIcon = (file: StorageFile | { name: string; isDirectory?: boolean }) => {
    if (file.isDirectory) return Folder
    const ext = file.name.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'csv':
        return FileSpreadsheet
      case 'json':
        return FileJson
      case 'xlsx':
      case 'xls':
        return FileSpreadsheet
      case 'parquet':
        return File
      default:
        return FileText
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const buildTreeNodes = (): TreeNode[] => {
    return connections
      .filter(isConnectionUsable)
      .map((connection) => {
        const connectionNode: TreeNode = {
          id: `conn-${connection.id}`,
          label: connection.name,
          type: 'connection',
          icon: HardDrive,
          connectionId: connection.id,
          children: [] // Files will be loaded dynamically
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

      // Load files when expanding connection or folder
      if (node.type === 'connection' && node.connectionId) {
        await fetchFiles(node.connectionId, '')
      } else if (node.type === 'folder' && node.connectionId && node.filePath) {
        await fetchFiles(node.connectionId, node.filePath)
      }
    }
  }

  const handleNodeSelect = async (node: TreeNode) => {
    setSelectedNode(node)
    setPreviewError(null)
    setFilePreview(null)

    // Load file preview if it's a file node
    if (node.type === 'file' && node.connectionId && node.filePath && !node.isDirectory) {
      setIsLoadingPreview(true)
      try {
        const response = await fetch(
          `/api/storage-connections/${node.connectionId}/preview`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: node.filePath, maxRows: 100 })
          }
        )
        const data = await response.json()

        if (data.success) {
          setFilePreview(data)
        } else {
          setPreviewError(data.error || 'Failed to load preview')
        }
      } catch (error) {
        setPreviewError('Failed to fetch file preview')
      } finally {
        setIsLoadingPreview(false)
      }
    }
  }

  const renderTreeNode = (node: TreeNode, level: number = 0): React.ReactNode => {
    const isExpanded = node.isExpanded || expandedNodes.has(node.id)
    const isSelected = selectedNode?.id === node.id
    const Icon = node.icon
    const hasChildren = node.type === 'connection' || node.type === 'folder'
    const cacheKey = node.connectionId ? `${node.connectionId}:${node.filePath || ''}` : ''
    const isLoadingNode = isLoadingFiles[cacheKey]

    // Get files for connection/folder nodes
    let childNodes = node.children || []
    if ((node.type === 'connection' || node.type === 'folder') && node.connectionId && isExpanded) {
      const filesList = files[cacheKey] || []
      if (filesList.length > 0) {
        childNodes = filesList.map(file => ({
          id: `file-${node.connectionId}-${file.path}`,
          label: file.name,
          type: file.isDirectory ? 'folder' as const : 'file' as const,
          icon: getFileIcon(file),
          connectionId: node.connectionId,
          filePath: file.path,
          fileSize: file.size,
          isDirectory: file.isDirectory,
          children: file.isDirectory ? [] : undefined
        }))
      }
    }

    return (
      <div key={node.id}>
        <button
          onClick={() => {
            handleNodeSelect(node)
            if (hasChildren) {
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
          {hasChildren && (
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
          {!hasChildren && (
            <span className="w-4" />
          )}
          <Icon className={cn('w-4 h-4 flex-shrink-0', node.type === 'folder' && 'text-amber-500')} />
          <span className="truncate font-medium">{node.label}</span>
          {node.type === 'file' && !node.isDirectory && (
            <Badge variant="secondary" className="ml-auto text-xs">
              File
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
    if (!selectedNode || selectedNode.type !== 'file') return

    const connection = connections.find(c => c.id === selectedNode.connectionId)
    if (!connection) return

    sessionStorage.setItem('preselectedSource', JSON.stringify({
      connectionId: selectedNode.connectionId,
      connectionName: connection.name,
      filePath: selectedNode.filePath,
      storageType: connection.type
    }))

    router.push('/pipelines')
  }

  const filteredTreeNodes = React.useMemo(() => {
    const nodes = buildTreeNodes()
    if (!searchQuery.trim()) return nodes

    const query = searchQuery.toLowerCase()

    const filterNodes = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map(node => {
          const matchesSearch = node.label.toLowerCase().includes(query)

          // For connections, include file nodes in search even if not expanded
          let childrenToFilter = node.children || []
          if (node.type === 'connection' && node.connectionId) {
            const cacheKey = `${node.connectionId}:`
            const filesList = files[cacheKey] || []
            if (filesList.length > 0) {
              childrenToFilter = filesList.map(file => ({
                id: `file-${node.connectionId}-${file.path}`,
                label: file.name,
                type: file.isDirectory ? 'folder' as const : 'file' as const,
                icon: getFileIcon(file),
                connectionId: node.connectionId,
                filePath: file.path,
                fileSize: file.size,
                isDirectory: file.isDirectory
              }))
            }
          }

          const filteredChildren = childrenToFilter.length > 0 ? filterNodes(childrenToFilter) : []

          if (matchesSearch || filteredChildren.length > 0) {
            return {
              ...node,
              children: filteredChildren.length > 0 ? filteredChildren : node.children,
              isExpanded: filteredChildren.length > 0 ? true : node.isExpanded
            }
          }
          return null
        })
        .filter((node): node is TreeNode => node !== null)
    }

    return filterNodes(nodes)
  }, [connections, searchQuery, files])

  const renderMainPanel = () => {
    if (!selectedNode) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center max-w-md">
            <HardDrive className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold text-foreground mb-2">
              Storage Explorer
            </h2>
            <p className="text-sm text-muted-foreground">
              Select a connection or file from the tree view to explore your data files.
            </p>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'connection') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      const cacheKey = `${connection.id}:`
      const fileCount = files[cacheKey]?.length || 0

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <HardDrive className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{connection.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {connection.type === 'local' ? 'Local Storage' : 'S3 / Object Storage'}
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
                <p className="text-xs text-muted-foreground mb-1">Type</p>
                <p className="font-medium text-sm text-foreground">
                  {connection.type === 'local' ? 'Local File System' : 'S3 Compatible'}
                </p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Path / Bucket</p>
                <p className="font-mono text-sm text-foreground truncate">
                  {connection.config?.basePath || connection.config?.bucket || '-'}
                </p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Files</p>
                {fileCount > 0 ? (
                  <p className="font-medium text-sm text-foreground">{fileCount} files</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">Not loaded</p>
                )}
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

    if (selectedNode.type === 'folder') {
      const connection = connections.find(c => c.id === selectedNode.connectionId)
      if (!connection) return null

      const cacheKey = `${selectedNode.connectionId}:${selectedNode.filePath || ''}`
      const fileCount = files[cacheKey]?.length || 0

      return (
        <div className="p-6">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-lg bg-primary/10">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-foreground">{selectedNode.label}</h2>
                <p className="text-sm text-muted-foreground">Folder in {connection.name}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Connection</p>
                <p className="font-medium text-sm text-foreground">{connection.name}</p>
              </div>
              <div className="p-4 bg-card border rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Path</p>
                <p className="font-mono text-sm text-foreground truncate">{selectedNode.filePath}</p>
              </div>
            </div>

            <div className="bg-card border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Folder Contents</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">Files</span>
                  </div>
                  {fileCount > 0 ? (
                    <span className="text-sm font-medium text-foreground">{fileCount}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not loaded</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Expand the folder in the tree to browse files and subfolders.
              </p>
            </div>
          </div>
        </div>
      )
    }

    if (selectedNode.type === 'file' && !selectedNode.isDirectory) {
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

      if (filePreview) {
        return (
          <div className="h-full flex flex-col min-h-0">
            {/* File Header */}
            <div className="border-b bg-card p-4 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{selectedNode.label}</h2>
                  <p className="text-sm text-muted-foreground">
                    {filePreview.schema?.length || 0} columns • {filePreview.metadata?.rowCount?.toLocaleString() || 'Unknown'} total rows • {formatFileSize(selectedNode.fileSize || 0)}
                  </p>
                </div>
                <Button onClick={handleAddToJob} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add to Job
                </Button>
              </div>
            </div>

            {/* Tabs: Schema, Preview, Insights */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <Tabs defaultValue="schema" className="h-full flex flex-col min-h-0 overflow-hidden">
                <div className="border-b px-4 flex-shrink-0">
                  <TabsList className="bg-transparent h-auto p-0">
                    <TabsTrigger value="schema" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      Schema ({filePreview.schema?.length || 0} columns)
                    </TabsTrigger>
                    <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      Preview (first 100 rows)
                    </TabsTrigger>
                    <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                      AI Insights
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
                            <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Sample Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filePreview.schema?.map((col, idx) => {
                            const isPK = filePreview.metadata?.pk_candidates?.includes(col.name)
                            const isTemporal = filePreview.metadata?.temporal_columns?.includes(col.name)

                            return (
                              <tr key={idx} className="border-b border-primary-100 hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                                <td className="p-3 font-mono text-foreground">
                                  {col.name}
                                  {isPK && <span className="ml-2 text-xs text-blue-600 font-semibold">(PK)</span>}
                                  {isTemporal && <span className="ml-2 text-xs text-purple-600 font-semibold">(Date)</span>}
                                </td>
                                <td className="p-3 text-muted-foreground">{col.type}</td>
                                <td className="p-3">
                                  <Badge variant={col.nullable ? 'secondary' : 'outline'} className="text-xs">
                                    {col.nullable ? 'Yes' : 'No'}
                                  </Badge>
                                </td>
                                <td className="p-3 text-muted-foreground text-xs truncate max-w-xs" title={col.sample}>
                                  {col.sample || <span className="italic">null</span>}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </TabsContent>

                {/* Preview Tab */}
                <TabsContent value="preview" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                  <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                    <div className="px-4 py-2 border-b bg-muted/30 text-foreground flex-shrink-0">
                      <p className="text-sm text-muted-foreground">
                        Showing first {Math.min(100, filePreview.preview?.length || 0)} of {filePreview.metadata?.rowCount?.toLocaleString() || 'Unknown'} total rows
                      </p>
                    </div>
                    <div className="overflow-auto flex-1 min-h-0">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 z-20 bg-primary text-white shadow-md border-b border-primary-700">
                          <tr>
                            {filePreview.schema?.map((col) => (
                              <th key={col.name} className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent whitespace-nowrap">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filePreview.preview?.map((row, idx) => (
                            <tr key={idx} className="border-b border-primary-100 hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                              {filePreview.schema?.map((col) => (
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

                {/* Insights Tab */}
                <TabsContent value="insights" className="flex-1 min-h-0 m-0 p-4 overflow-auto data-[state=inactive]:hidden">
                  <div className="space-y-4">
                    {/* Primary Key Candidates */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Primary Key Candidates
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Columns that appear to uniquely identify each row
                      </p>
                      {filePreview.metadata?.pk_candidates && filePreview.metadata.pk_candidates.length > 0 ? (
                        <div className="space-y-2">
                          {filePreview.metadata.pk_candidates.map((col) => (
                            <div key={col} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                              <span className="font-mono text-foreground">{col}</span>
                              <Badge variant="outline" className="ml-auto text-xs">AI Detected</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          <p>No primary key candidates detected</p>
                        </div>
                      )}
                    </div>

                    {/* Temporal Columns */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Temporal Columns
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Date and timestamp columns detected in the file
                      </p>
                      {filePreview.metadata?.temporal_columns && filePreview.metadata.temporal_columns.length > 0 ? (
                        <div className="space-y-2">
                          {filePreview.metadata.temporal_columns.map((col) => (
                            <div key={col} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                              <span className="font-mono text-foreground">{col}</span>
                              <Badge variant="outline" className="ml-auto text-xs">AI Detected</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-sm text-muted-foreground">
                          <p>No temporal columns detected</p>
                        </div>
                      )}
                    </div>

                    {/* File Metadata */}
                    <div className="border rounded-md p-4">
                      <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        File Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-2 bg-muted/30 rounded">
                          <p className="text-xs text-muted-foreground">Row Count</p>
                          <p className="text-sm font-medium text-foreground">{filePreview.metadata?.rowCount?.toLocaleString() || 'Unknown'}</p>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <p className="text-xs text-muted-foreground">File Size</p>
                          <p className="text-sm font-medium text-foreground">{formatFileSize(selectedNode.fileSize || filePreview.metadata?.fileSize || 0)}</p>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <p className="text-xs text-muted-foreground">Has Header</p>
                          <p className="text-sm font-medium text-foreground">{filePreview.metadata?.hasHeader ? 'Yes' : 'No'}</p>
                        </div>
                        <div className="p-2 bg-muted/30 rounded">
                          <p className="text-xs text-muted-foreground">Column Count</p>
                          <p className="text-sm font-medium text-foreground">{filePreview.schema?.length || 0}</p>
                        </div>
                      </div>
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
            <HardDrive className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Storage Connections
            </h2>
            <p className="text-muted-foreground mb-6">
              Create your first storage connection to start exploring data files.
              Connect to local file systems or S3-compatible object storage.
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
                <h3 className="text-sm font-semibold text-foreground">Storage Explorer</h3>
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
                    {searchQuery ? 'No matching items found' : 'No connected storage'}
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
                {connections.filter(isConnectionUsable).length} active {connections.filter(isConnectionUsable).length === 1 ? 'connection' : 'connections'}
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
  )
}
