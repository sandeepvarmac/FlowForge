'use client'

import React from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ArrowLeft,
  Database,
  Table2,
  Search,
  Loader2,
  Plus,
  AlertCircle,
  Eye,
  CheckCircle2
} from 'lucide-react'
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

export default function SourceExplorerPage() {
  const params = useParams()
  const router = useRouter()
  const connectionId = params.id as string

  // Connection state
  const [connection, setConnection] = React.useState<any>(null)
  const [isLoadingConnection, setIsLoadingConnection] = React.useState(true)
  const [connectionError, setConnectionError] = React.useState<string | null>(null)

  // Tables state
  const [tables, setTables] = React.useState<TableInfo[]>([])
  const [isLoadingTables, setIsLoadingTables] = React.useState(false)
  const [tablesError, setTablesError] = React.useState<string | null>(null)

  // Selected table state
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null)
  const [tablePreview, setTablePreview] = React.useState<TablePreview | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = React.useState(false)
  const [previewError, setPreviewError] = React.useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = React.useState('')

  // Load connection details
  React.useEffect(() => {
    const fetchConnection = async () => {
      try {
        setIsLoadingConnection(true)
        const response = await fetch(`/api/database-connections/${connectionId}`)
        const data = await response.json()

        if (data.success) {
          setConnection(data.connection)
        } else {
          setConnectionError(data.error || 'Failed to load connection')
        }
      } catch (error) {
        setConnectionError('Failed to fetch connection details')
      } finally {
        setIsLoadingConnection(false)
      }
    }

    fetchConnection()
  }, [connectionId])

  // Load tables when connection is loaded
  React.useEffect(() => {
    if (!connection) return

    const fetchTables = async () => {
      try {
        setIsLoadingTables(true)
        setTablesError(null)
        const response = await fetch(`/api/database-connections/${connectionId}/tables`)
        const data = await response.json()

        if (data.success) {
          setTables(data.tables?.map((name: string) => ({ name })) || [])
        } else {
          setTablesError(data.error || 'Failed to load tables')
        }
      } catch (error) {
        setTablesError('Failed to fetch tables')
      } finally {
        setIsLoadingTables(false)
      }
    }

    fetchTables()
  }, [connection, connectionId])

  // Load table preview when selected
  const handleTableSelect = async (tableName: string) => {
    setSelectedTable(tableName)
    setIsLoadingPreview(true)
    setPreviewError(null)
    setTablePreview(null)

    try {
      const response = await fetch(
        `/api/database-connections/${connectionId}/tables/${tableName}?action=preview&limit=100`
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

  // Filter tables by search query
  const filteredTables = React.useMemo(() => {
    if (!searchQuery.trim()) return tables
    const query = searchQuery.toLowerCase()
    return tables.filter(t => t.name.toLowerCase().includes(query))
  }, [tables, searchQuery])

  // Handle "Add to Job" - navigate to workflows page
  const handleAddToJob = () => {
    if (!selectedTable) return

    // Store the pre-selection in sessionStorage for the workflows page to pick up
    sessionStorage.setItem('preselectedSource', JSON.stringify({
      connectionId: connectionId,
      connectionName: connection.name,
      tableName: selectedTable,
      databaseType: connection.type
    }))

    // Navigate to pipelines page
    router.push('/pipelines')
  }

  if (isLoadingConnection) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm text-muted-foreground">Loading connection...</p>
        </div>
      </div>
    )
  }

  if (connectionError || !connection) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <h2 className="text-lg font-semibold mb-2">Connection Not Found</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {connectionError || 'Unable to load connection details'}
            </p>
            <Button onClick={() => router.push('/data-assets/sources')}>
              Back to Source Data
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/data-assets/sources')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Source Data
              </Button>
              <div className="h-6 w-px bg-border" />
              <Database className="w-5 h-5 text-muted-foreground" />
              <div>
                <h1 className="text-xl font-semibold text-foreground">{connection.name}</h1>
                <p className="text-xs text-muted-foreground">
                  {connection.type} • {connection.database}
                </p>
              </div>
            </div>
            <Badge variant="success">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Connected
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Tables List */}
        <div className="w-80 border-r bg-card flex flex-col">
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tables..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isLoadingTables ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary mb-2" />
                <p className="text-xs text-muted-foreground">Loading tables...</p>
              </div>
            ) : tablesError ? (
              <div className="text-center py-8">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-destructive" />
                <p className="text-sm text-foreground font-medium mb-1">Failed to Load Tables</p>
                <p className="text-xs text-muted-foreground">{tablesError}</p>
              </div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-8">
                <Table2 className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-foreground font-medium mb-1">
                  {searchQuery ? 'No matching tables' : 'No tables found'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {searchQuery ? 'Try a different search query' : 'This database appears to be empty'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredTables.map((table) => (
                  <button
                    key={table.name}
                    onClick={() => handleTableSelect(table.name)}
                    className={cn(
                      'w-full text-left p-3 rounded-md transition-colors',
                      'hover:bg-accent',
                      selectedTable === table.name
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 flex-shrink-0" />
                      <span className="text-sm font-medium truncate">{table.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground">
              {filteredTables.length} {filteredTables.length === 1 ? 'table' : 'tables'}
              {searchQuery && ` matching "${searchQuery}"`}
            </div>
          </div>
        </div>

        {/* Main Panel - Table Preview */}
        <div className="flex-1 flex flex-col bg-background">
          {!selectedTable ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-md">
                <Eye className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <h2 className="text-lg font-semibold text-foreground mb-2">
                  Explore Your Data
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select a table from the sidebar to preview its schema and data.
                  You can then add it to a workflow for ingestion.
                </p>
              </div>
            </div>
          ) : isLoadingPreview ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            </div>
          ) : previewError ? (
            <div className="flex items-center justify-center h-full">
              <Card className="max-w-md">
                <CardContent className="p-6 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
                  <h2 className="text-lg font-semibold mb-2">Preview Failed</h2>
                  <p className="text-sm text-muted-foreground">{previewError}</p>
                </CardContent>
              </Card>
            </div>
          ) : tablePreview ? (
            <div className="flex-1 flex flex-col">
              {/* Table Header */}
              <div className="border-b bg-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">{selectedTable}</h2>
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

              {/* Tabs: Schema & Data Preview */}
              <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="data" className="h-full flex flex-col">
                  <div className="border-b px-4">
                    <TabsList className="bg-transparent h-auto p-0">
                      <TabsTrigger value="data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Data Preview ({tablePreview.rows.length} rows)
                      </TabsTrigger>
                      <TabsTrigger value="schema" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                        Schema ({tablePreview.schema.length} columns)
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="data" className="flex-1 overflow-auto m-0 p-4">
                    <div className="border rounded-md overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            {tablePreview.schema.map((col) => (
                              <th key={col.name} className="text-left p-3 font-medium text-foreground border-b">
                                {col.name}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tablePreview.rows.map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              {tablePreview.schema.map((col) => (
                                <td key={col.name} className="p-3 text-muted-foreground">
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
                  </TabsContent>

                  <TabsContent value="schema" className="flex-1 overflow-auto m-0 p-4">
                    <div className="border rounded-md overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted sticky top-0">
                          <tr>
                            <th className="text-left p-3 font-medium text-foreground border-b">Column Name</th>
                            <th className="text-left p-3 font-medium text-foreground border-b">Data Type</th>
                            <th className="text-left p-3 font-medium text-foreground border-b">Nullable</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tablePreview.schema.map((col, idx) => (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-3 font-mono text-foreground">{col.name}</td>
                              <td className="p-3 text-muted-foreground">{col.type}</td>
                              <td className="p-3">
                                <Badge variant={col.nullable ? 'secondary' : 'outline'} className="text-xs">
                                  {col.nullable ? 'Yes' : 'No'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
