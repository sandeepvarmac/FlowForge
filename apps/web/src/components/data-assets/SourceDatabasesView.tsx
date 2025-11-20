'use client'

import React from 'react'
import { Database, Table, RefreshCw, AlertCircle, CheckCircle2, Copy } from 'lucide-react'

interface SourceDatabasesViewProps {
  onBackToProcessed?: () => void
  searchTerm?: string
}

export function SourceDatabasesView({ onBackToProcessed, searchTerm = '' }: SourceDatabasesViewProps) {
  const [connections, setConnections] = React.useState<any[]>([])
  const [selectedConnection, setSelectedConnection] = React.useState<any>(null)
  const [tables, setTables] = React.useState<string[]>([])
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null)
  const [tablePreview, setTablePreview] = React.useState<any>(null)
  const [loadingConnections, setLoadingConnections] = React.useState(true)
  const [loadingTables, setLoadingTables] = React.useState(false)
  const [loadingPreview, setLoadingPreview] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [activePreviewTab, setActivePreviewTab] = React.useState<'schema' | 'data'>('schema')
  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredConnections = React.useMemo(() => {
    if (!normalizedSearch) return connections
    return connections.filter((connection) => {
      const haystack = `${connection.name || ''} ${connection.database || ''} ${connection.host || ''}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })
  }, [connections, normalizedSearch])

  const filteredTables = React.useMemo(() => {
    if (!normalizedSearch) return tables
    return tables.filter((table) => table.toLowerCase().includes(normalizedSearch))
  }, [tables, normalizedSearch])

  React.useEffect(() => {
    if (!filteredConnections.length) {
      setSelectedConnection(null)
      return
    }
    if (!selectedConnection || !filteredConnections.some((c) => c.id === selectedConnection.id)) {
      setSelectedConnection(filteredConnections[0])
    }
  }, [filteredConnections, selectedConnection])

  React.useEffect(() => {
    if (!filteredTables.length) {
      setSelectedTable(null)
      return
    }
    if (!selectedTable || !filteredTables.includes(selectedTable)) {
      setSelectedTable(filteredTables[0])
    }
  }, [filteredTables, selectedTable])

  // Load database connections
  React.useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    setLoadingConnections(true)
    setError(null)
    try {
      const response = await fetch('/api/database-connections')
      const data = await response.json()

      if (data.success) {
        setConnections(data.connections || [])
        if (data.connections?.length > 0) {
          setSelectedConnection(data.connections[0])
        }
      } else {
        setError(data.message || 'Failed to load connections')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load connections')
    } finally {
      setLoadingConnections(false)
    }
  }

  // Load tables when connection is selected
  React.useEffect(() => {
    if (selectedConnection) {
      loadTables(selectedConnection.id)
    }
  }, [selectedConnection])

  const loadTables = async (connectionId: string) => {
    setLoadingTables(true)
    setError(null)
    setTables([])
    setSelectedTable(null)
    setTablePreview(null)

    try {
      const response = await fetch(`/api/database-connections/${connectionId}/tables`)
      const data = await response.json()

      if (data.success) {
        setTables(data.tables || [])
        if (data.tables?.length > 0) {
          setSelectedTable(data.tables[0])
        }
      } else {
        setError(data.error || 'Failed to load tables')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tables')
    } finally {
      setLoadingTables(false)
    }
  }

  // Load table preview when table is selected
  React.useEffect(() => {
    if (selectedConnection && selectedTable) {
      loadTablePreview(selectedConnection.id, selectedTable)
    }
  }, [selectedConnection, selectedTable])

  const loadTablePreview = async (connectionId: string, tableName: string) => {
    setLoadingPreview(true)
    setError(null)

    try {
      const response = await fetch(`/api/database-connections/${connectionId}/tables/${tableName}?action=preview&limit=100`)
      const data = await response.json()

      if (data.success) {
        setTablePreview(data)
      } else {
        setError(data.error || 'Failed to load table preview')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load table preview')
    } finally {
      setLoadingPreview(false)
    }
  }

  if (loadingConnections) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
          <p className="text-sm text-gray-600">Loading database connections...</p>
        </div>
      </div>
    )
  }

  if (connections.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Database Connections</h3>
          <p className="text-sm text-gray-600 mb-6">
            Connect to your source databases to browse tables and preview data before ingestion.
          </p>
          <button
            onClick={() => window.location.href = '/integrations/sources'}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            Add Database Connection
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Left Panel: Connections */}
      <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">Connections</h3>
            <button
              onClick={loadConnections}
              className="p-1 hover:bg-gray-100 rounded"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <p className="text-xs text-gray-600">
            {filteredConnections.length} of {connections.length} connected
          </p>
        </div>

        <div className="p-2 space-y-1">
          {filteredConnections.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-500">
              No connections match your search
            </div>
          ) : (
            filteredConnections.map(conn => (
              <button
                key={conn.id}
                onClick={() => setSelectedConnection(conn)}
                className={`
                  w-full p-3 rounded-lg text-left transition-colors
                  ${selectedConnection?.id === conn.id
                    ? 'bg-primary-50 border border-primary-200'
                    : 'hover:bg-gray-50 border border-transparent'
                  }
                `}
              >
                <div className="flex items-start gap-2">
                  <Database className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    selectedConnection?.id === conn.id ? 'text-primary-600' : 'text-gray-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{conn.name}</div>
                    <div className="text-xs text-gray-500 truncate">{conn.type}</div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{conn.database}</div>
                  </div>
                  {conn.lastTestStatus === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Middle Panel: Tables */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 overflow-y-auto">
        <div className="p-4 bg-white border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Tables</h3>
          <p className="text-xs text-gray-600">
            {loadingTables
              ? 'Loading...'
              : `${filteredTables.length} / ${tables.length} tables`}
          </p>
        </div>

        {filteredConnections.length === 0 ? (
          <div className="p-8 text-center">
            <Table className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-600">Select a connection to view tables</p>
          </div>
        ) : loadingTables ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 mx-auto mb-3 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
            <p className="text-sm text-gray-600">Loading tables...</p>
          </div>
        ) : error ? (
          <div className="p-4">
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 mb-1">Failed to load tables</p>
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              </div>
            </div>
          </div>
        ) : filteredTables.length === 0 ? (
          <div className="p-8 text-center">
            <Table className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm text-gray-600">No tables match your search</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredTables.map(tableName => (
              <button
                key={tableName}
                onClick={() => setSelectedTable(tableName)}
                className={`
                  w-full p-2 px-3 rounded-lg text-left transition-colors text-sm
                  ${selectedTable === tableName
                    ? 'bg-primary-50 text-primary-700 font-medium border border-primary-200'
                    : 'text-gray-700 hover:bg-gray-100 border border-transparent'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <Table className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{tableName}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right Panel: Table Preview */}
      <div className="flex-1 bg-white overflow-hidden flex flex-col">
        {selectedTable ? (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{selectedTable}</h3>
                  <p className="text-sm text-gray-600 mt-0.5">
                    {selectedConnection?.database} • {selectedConnection?.name}
                  </p>
                </div>
                {tablePreview && (
                  <div className="text-sm text-gray-600">
                    {tablePreview.row_count?.toLocaleString()} rows • {tablePreview.schema?.length} columns
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {loadingPreview ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                  <p className="text-sm text-gray-600">Loading table preview...</p>
                </div>
              ) : tablePreview ? (
                <div className="flex flex-col">
                  <div className="border-b border-gray-200 mb-4">
                    <nav className="-mb-px flex space-x-8">
                      {[
                        { id: 'schema', label: 'Schema' },
                        { id: 'data', label: 'Data Preview' },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setActivePreviewTab(tab.id as 'schema' | 'data')}
                          className={`whitespace-nowrap py-4 px-1 border-b-2 text-sm font-medium ${
                            activePreviewTab === tab.id
                              ? 'border-primary-600 text-primary-700'
                              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </nav>
                  </div>

                  {activePreviewTab === 'schema' ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[500px] flex flex-col">
                      <div className="overflow-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Column</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                              <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase">Nullable</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {tablePreview.schema?.map((col: any, idx: number) => (
                              <tr key={idx} className="hover:bg-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-900">{col.name}</td>
                                <td className="px-4 py-2 text-gray-600">{col.type}</td>
                                <td className="px-4 py-2 text-gray-600">{col.nullable ? 'Yes' : 'No'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold text-gray-900">Sample Data</h4>
                        <span className="text-xs text-gray-600">
                          Showing {tablePreview.total_rows} of {tablePreview.row_count?.toLocaleString()} rows
                        </span>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[500px]">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 bg-gray-100 border-r border-gray-200">#</th>
                              {tablePreview.schema?.map((col: any, idx: number) => (
                                <th key={idx} className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap border-r border-gray-200 last:border-r-0">
                                  {col.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {tablePreview.rows?.map((row: any, rowIdx: number) => (
                              <tr key={rowIdx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-r border-gray-200 font-medium">
                                  {rowIdx + 1}
                                </td>
                                {tablePreview.schema?.map((col: any, colIdx: number) => {
                                  const value = row[col.name]
                                  const displayValue = value === null || value === undefined
                                    ? <span className="text-gray-400 italic">null</span>
                                    : typeof value === 'object'
                                    ? JSON.stringify(value)
                                    : String(value)

                                  return (
                                    <td
                                      key={colIdx}
                                      className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200 last:border-r-0 max-w-xs truncate"
                                      title={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                    >
                                      {displayValue}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <Table className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select a table to view its schema and data</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
