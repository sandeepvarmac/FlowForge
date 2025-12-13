"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Input } from "@/components/ui"
import { FormField, FormLabel, FormError, Select } from "@/components/ui/form"
import { Database, CheckCircle2, AlertCircle, Loader2, Table, Eye, RefreshCw } from "lucide-react"
import { ConnectionConfig, DatabaseSourceConfig as DatabaseConfig } from "@/types/workflow"
import { SchemaLoadingProgress, type SchemaLoadingStep } from "@/components/shared/schema-loading-progress"
import { SchemaSuccessCard } from "@/components/shared/schema-success-card"

interface DatabaseSourceConfigProps {
  dbType: 'sql-server' | 'postgresql' | 'mysql' | 'oracle'
  connection: Partial<ConnectionConfig>
  databaseConfig: Partial<DatabaseConfig>
  onConnectionChange: (connection: Partial<ConnectionConfig>) => void
  onDatabaseConfigChange: (config: Partial<DatabaseConfig>) => void
  onSchemaDetected?: (
    schema: Array<{ name: string; type: string }>,
    tableName: string,
    metadata?: { temporal_columns?: string[]; pk_candidates?: string[]; preview?: any[]; rowCount?: number }
  ) => void
  useSavedConnection?: boolean // When true, hide connection form and only show table selection
  connectionId?: string // ID of saved connection (for password lookup)
  // Column exclusion props (for parity with Storage Connection)
  excludedColumns?: string[]
  onExcludedColumnsChange?: (excludedColumns: string[]) => void
}

interface ConnectionState {
  isConnecting: boolean
  isConnected: boolean
  connectionError: string | null
  availableTables: string[]
  isLoadingTables: boolean
  tableSchema: any[] | null
  fullSchemaData: any[] | null // Full schema with all metadata
  isLoadingSchema: boolean
  schemaError: string | null
  schemaLoadingStep: SchemaLoadingStep
  schemaProgressPercent: number
  rowCount: number | null
  previewData: any[] | null // Preview data rows
}

const dbTypeLabels = {
  'sql-server': 'SQL Server',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'oracle': 'Oracle'
}

function buildSampleMap(rows: any[] | null) {
  const sampleMap: Record<string, any> = {}
  rows?.forEach((row: Record<string, any>) => {
    Object.entries(row).forEach(([key, value]) => {
      if (sampleMap[key] === undefined && value !== null && value !== undefined && value !== '') {
        sampleMap[key] = value
      }
    })
  })
  return sampleMap
}

export function DatabaseSourceConfig({
  dbType,
  connection,
  databaseConfig,
  onConnectionChange,
  onDatabaseConfigChange,
  onSchemaDetected,
  useSavedConnection = false,
  connectionId,
  excludedColumns = [],
  onExcludedColumnsChange
}: DatabaseSourceConfigProps) {
  const [state, setState] = React.useState<ConnectionState>({
    isConnecting: false,
    isConnected: useSavedConnection, // If using saved connection, start as connected
    connectionError: null,
    availableTables: [],
    isLoadingTables: false,
    tableSchema: null,
    fullSchemaData: null,
    isLoadingSchema: false,
    schemaError: null,
    schemaLoadingStep: 'connecting',
    schemaProgressPercent: 0,
    rowCount: null,
    previewData: null
  })

  // Auto-load tables when using saved connection
  React.useEffect(() => {
    console.log('DatabaseSourceConfig useEffect:', {
      useSavedConnection,
      hasDatabase: !!connection.database,
      isConnected: state.isConnected,
      database: connection.database
    })

    if (useSavedConnection && connection.database && state.isConnected) {
      console.log('Auto-loading tables...')
      loadTables()
    }
  }, [useSavedConnection, connection.database, connection.host, connection.port, state.isConnected])

  const [showPassword, setShowPassword] = React.useState(false)

  const testConnection = async () => {
    setState(prev => ({ ...prev, isConnecting: true, connectionError: null }))

    try {
      const response = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType,
          connection
        })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: true,
          connectionError: null
        }))

        // Auto-load tables after successful connection
        loadTables()
      } else {
        setState(prev => ({
          ...prev,
          isConnecting: false,
          isConnected: false,
          connectionError: result.message || 'Connection failed'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        isConnected: false,
        connectionError: 'Failed to test connection. Please try again.'
      }))
    }
  }

  const loadTables = async () => {
    console.log('loadTables called:', {
      isConnected: state.isConnected,
      hasDatabase: !!connection.database,
      dbType,
      connectionId,
      useSavedConnection
    })

    // Skip if not connected OR missing connection details
    if (!state.isConnected || !connection.database) {
      console.log('Skipping loadTables - not ready')
      return
    }

    console.log('Loading tables from API...')
    setState(prev => ({ ...prev, isLoadingTables: true }))

    try {
      // Build request body - use connectionId for saved connections, full connection for new ones
      const requestBody: any = { dbType }

      if (useSavedConnection && connectionId) {
        requestBody.connectionId = connectionId
        console.log('Using saved connection ID:', connectionId)
      } else {
        requestBody.connection = connection
        console.log('Using direct connection object')
      }

      const response = await fetch('/api/database/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()
      console.log('Tables API response:', result)

      if (result.success) {
        console.log('Tables loaded successfully:', result.tables)
        setState(prev => ({
          ...prev,
          isLoadingTables: false,
          availableTables: result.tables || []
        }))
      } else {
        console.error('Tables API returned error:', result.message)
        setState(prev => ({
          ...prev,
          isLoadingTables: false,
          availableTables: []
        }))
      }
    } catch (error) {
      console.error('Error loading tables:', error)
      setState(prev => ({
        ...prev,
        isLoadingTables: false,
        availableTables: []
      }))
    }
  }

  const loadSchema = async (tableName: string) => {
    // Stage 1: Connecting (0-30%)
    setState(prev => ({
      ...prev,
      isLoadingSchema: true,
      schemaError: null,
      schemaLoadingStep: 'connecting',
      schemaProgressPercent: 0
    }))

    try {
      // Simulate progress stages for better UX
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          schemaLoadingStep: 'analyzing',
          schemaProgressPercent: 30
        }))
      }, 500)

      setTimeout(() => {
        setState(prev => ({
          ...prev,
          schemaLoadingStep: 'detecting',
          schemaProgressPercent: 60
        }))
      }, 1500)

      let result: any
      if (useSavedConnection && connectionId) {
        // Use the dedicated schema route for saved connections
        const resp = await fetch(`/api/database-connections/${connectionId}/tables/${tableName}?action=schema`)
        result = await resp.json()
      } else {
        // Fallback to generic route for ad-hoc connections
        const requestBody: any = { dbType, tableName, connection }
        const resp = await fetch('/api/database/schema', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        })
        result = await resp.json()
      }

      if (result.success) {
        let previewData: any[] | null = result.preview || null
        let resolvedRowCount: number | null = result.row_count || previewData?.length || null

        // Fallback: fetch preview data if schema route did not return any
        if ((!previewData || previewData.length === 0) && useSavedConnection && connectionId) {
          try {
            const previewResp = await fetch(`/api/database-connections/${connectionId}/tables/${tableName}?action=preview&limit=20`)
            const previewJson = await previewResp.json()
            if (previewJson.success) {
              previewData = previewJson.rows || []
              resolvedRowCount = previewJson.row_count || previewJson.total_rows || previewData.length || resolvedRowCount
            }
          } catch (previewError) {
            console.error('[DatabaseSourceConfig] Failed to fetch preview data:', previewError)
          }
        }

        const sampleMap = buildSampleMap(previewData)

        // Stage 4: Profiling (90-100%)
        setState(prev => ({
          ...prev,
          schemaLoadingStep: 'profiling',
          schemaProgressPercent: 90
        }))

        console.log('[DatabaseSourceConfig] Schema API response:', {
          hasSchema: !!result.schema,
          schemaLength: result.schema?.length,
          hasPreview: !!result.preview,
          previewLength: result.preview?.length,
          rowCount: result.row_count
        })

        const schema = (result.schema || []).map((col: any) => {
          const columnName = col.name ?? col.column_name ?? ''
          const columnType = col.type ?? col.data_type
          return {
            ...col,
            name: columnName,
            type: columnType,
            sample: col.sample ?? sampleMap[columnName]
          }
        })

        // Complete
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            isLoadingSchema: false,
            tableSchema: schema,
            fullSchemaData: schema,
            rowCount: resolvedRowCount || null,
            previewData: previewData || null,
            schemaError: null,
            schemaProgressPercent: 100,
            schemaLoadingStep: 'complete'
          }))

          // Notify parent of schema detection with metadata
          console.log('[DatabaseSourceConfig] Schema loaded, calling onSchemaDetected with', schema.length, 'columns for table:', tableName)
          console.log('[DatabaseSourceConfig] Metadata:', result.metadata)
          if (onSchemaDetected) {
            console.log('[DatabaseSourceConfig] onSchemaDetected callback exists, calling it now with tableName:', tableName)
            onSchemaDetected(
              schema.map(col => ({ name: col.name, type: col.type })),
              tableName,
              {
              temporal_columns: result.metadata?.temporal_columns || [],
              pk_candidates: result.metadata?.pk_candidates || [],
              preview: previewData || [],
              rowCount: resolvedRowCount || previewData?.length || undefined
            }
            )
          } else {
            console.log('[DatabaseSourceConfig] WARNING: onSchemaDetected callback is NULL!')
          }
        }, 500)
      } else {
        setState(prev => ({
          ...prev,
          isLoadingSchema: false,
          tableSchema: null,
          fullSchemaData: null,
          previewData: null,
          schemaError: result.message || result.error || 'Failed to load schema'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingSchema: false,
        tableSchema: null,
        fullSchemaData: null,
        previewData: null,
        schemaError: 'Failed to load table schema'
      }))
    }
  }

  const handleTableSelect = (tableName: string) => {
    onDatabaseConfigChange({ ...databaseConfig, tableName })
    if (tableName) {
      loadSchema(tableName)
    }
  }

  return (
    <div className="space-y-6">
      {/* Only show connection form if NOT using saved connection */}
      {!useSavedConnection && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">{dbTypeLabels[dbType]} Connection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Connection Fields */}
            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel required>Host</FormLabel>
                <Input
                  placeholder="localhost or IP address"
                  value={connection.host || ''}
                  onChange={(e) => onConnectionChange({ ...connection, host: e.target.value })}
                />
              </FormField>

              <FormField>
                <FormLabel required>Port</FormLabel>
                <Input
                  type="number"
                  placeholder={dbType === 'sql-server' ? '1433' : dbType === 'postgresql' ? '5432' : '3306'}
                  value={connection.port || ''}
                  onChange={(e) => onConnectionChange({ ...connection, port: parseInt(e.target.value) || undefined })}
                />
              </FormField>

              <FormField>
                <FormLabel required>Database Name</FormLabel>
                <Input
                  placeholder="database_name"
                  value={connection.database || ''}
                  onChange={(e) => onConnectionChange({ ...connection, database: e.target.value })}
                />
              </FormField>

              <FormField>
                <FormLabel required>Username</FormLabel>
                <Input
                  placeholder="db_user"
                  value={connection.username || ''}
                  onChange={(e) => onConnectionChange({ ...connection, username: e.target.value })}
                />
              </FormField>

              <FormField className="col-span-2">
                <FormLabel required>Password</FormLabel>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={connection.password || ''}
                    onChange={(e) => onConnectionChange({ ...connection, password: e.target.value })}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </FormField>
            </div>

            {/* Test Connection Button */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={testConnection}
                disabled={state.isConnecting || !connection.host || !connection.database || !connection.username || !connection.password}
                className="flex items-center gap-2"
              >
                {state.isConnecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    Test Connection
                  </>
                )}
              </Button>

              {state.isConnected && (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Connected
                </Badge>
              )}

              {state.connectionError && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {state.connectionError}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table Selection (shown after connection OR when using saved connection) */}
      {state.isConnected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Table className="h-5 w-5 text-blue-600" />
                <CardTitle className="text-lg">Table Selection</CardTitle>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={loadTables}
                disabled={state.isLoadingTables}
              >
                <RefreshCw className={`h-4 w-4 ${state.isLoadingTables ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField>
              <FormLabel required>Table Name</FormLabel>
              <Select
                value={databaseConfig.tableName || ''}
                onChange={(e) => handleTableSelect(e.target.value)}
                disabled={state.isLoadingTables}
              >
                <option value="">Select a table...</option>
                {state.availableTables.map((table) => (
                  <option key={table} value={table}>
                    {table}
                  </option>
                ))}
              </Select>
              {state.isLoadingTables && (
                <p className="text-sm text-muted-foreground mt-2">Loading tables...</p>
              )}
            </FormField>
          </CardContent>
        </Card>
      )}

      {/* AI-Powered Schema Loading & Preview */}
      {databaseConfig.tableName && (
        <div className="space-y-6">
          {state.isLoadingSchema ? (
            <div className="border-2 border-dashed border-border rounded-lg p-8">
              <SchemaLoadingProgress
                step={state.schemaLoadingStep}
                progressPercent={state.schemaProgressPercent}
                sourceType="database"
              />
            </div>
          ) : state.schemaError ? (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {state.schemaError}
                </div>
              </CardContent>
            </Card>
          ) : state.tableSchema ? (
            <SchemaSuccessCard
              sourceName={databaseConfig.tableName}
              sourceType="database"
              schema={state.fullSchemaData || state.tableSchema}
              rowCount={state.rowCount || undefined}
              metadata={{
                dbType: dbTypeLabels[dbType],
                connectionName: connection.database
              }}
              showAiBadge={true}
              expandInline={true}
              previewData={state.previewData || undefined}
              excludedColumns={excludedColumns}
              onExcludedColumnsChange={onExcludedColumnsChange}
              onClear={() => {
                onDatabaseConfigChange({ ...databaseConfig, tableName: '' })
                setState(prev => ({
                  ...prev,
                  tableSchema: null,
                  fullSchemaData: null,
                  previewData: null,
                  schemaError: null
                }))
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
