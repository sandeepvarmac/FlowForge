"use client"

import * as React from "react"
import { Button, Badge } from "@/components/ui"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Input } from "@/components/ui"
import { FormField, FormLabel, FormError, Select } from "@/components/ui/form"
import { Database, CheckCircle2, AlertCircle, Loader2, Table, Eye, RefreshCw } from "lucide-react"
import { ConnectionConfig, DatabaseSourceConfig as DatabaseConfig } from "@/types/workflow"

interface DatabaseSourceConfigProps {
  dbType: 'sql-server' | 'postgresql' | 'mysql' | 'oracle'
  connection: Partial<ConnectionConfig>
  databaseConfig: Partial<DatabaseConfig>
  onConnectionChange: (connection: Partial<ConnectionConfig>) => void
  onDatabaseConfigChange: (config: Partial<DatabaseConfig>) => void
  onSchemaDetected?: (schema: Array<{ name: string; type: string }>) => void
}

interface ConnectionState {
  isConnecting: boolean
  isConnected: boolean
  connectionError: string | null
  availableTables: string[]
  isLoadingTables: boolean
  tableSchema: Array<{ name: string; type: string }> | null
  isLoadingSchema: boolean
  schemaError: string | null
}

const dbTypeLabels = {
  'sql-server': 'SQL Server',
  'postgresql': 'PostgreSQL',
  'mysql': 'MySQL',
  'oracle': 'Oracle'
}

export function DatabaseSourceConfig({
  dbType,
  connection,
  databaseConfig,
  onConnectionChange,
  onDatabaseConfigChange,
  onSchemaDetected
}: DatabaseSourceConfigProps) {
  const [state, setState] = React.useState<ConnectionState>({
    isConnecting: false,
    isConnected: false,
    connectionError: null,
    availableTables: [],
    isLoadingTables: false,
    tableSchema: null,
    isLoadingSchema: false,
    schemaError: null
  })

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
    if (!state.isConnected && !connection.database) return

    setState(prev => ({ ...prev, isLoadingTables: true }))

    try {
      const response = await fetch('/api/database/tables', {
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
          isLoadingTables: false,
          availableTables: result.tables || []
        }))
      } else {
        setState(prev => ({
          ...prev,
          isLoadingTables: false,
          availableTables: []
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingTables: false,
        availableTables: []
      }))
    }
  }

  const loadSchema = async (tableName: string) => {
    setState(prev => ({ ...prev, isLoadingSchema: true, schemaError: null }))

    try {
      const response = await fetch('/api/database/schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dbType,
          connection,
          tableName
        })
      })

      const result = await response.json()

      if (result.success) {
        const schema = result.schema.map((col: any) => ({
          name: col.column_name,
          type: col.data_type
        }))

        setState(prev => ({
          ...prev,
          isLoadingSchema: false,
          tableSchema: schema,
          schemaError: null
        }))

        // Notify parent of schema detection
        if (onSchemaDetected) {
          onSchemaDetected(schema)
        }
      } else {
        setState(prev => ({
          ...prev,
          isLoadingSchema: false,
          tableSchema: null,
          schemaError: result.message || 'Failed to load schema'
        }))
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingSchema: false,
        tableSchema: null,
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
      {/* Database Type Header */}
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

      {/* Table Selection (shown after connection) */}
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

            {/* Incremental Load Options */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isIncremental"
                  checked={databaseConfig.isIncremental || false}
                  onChange={(e) => onDatabaseConfigChange({ ...databaseConfig, isIncremental: e.target.checked })}
                  className="h-4 w-4"
                />
                <label htmlFor="isIncremental" className="text-sm font-medium">
                  Enable Incremental Load
                </label>
              </div>

              {databaseConfig.isIncremental && (
                <div className="ml-6 space-y-3">
                  <FormField>
                    <FormLabel required>Delta Column</FormLabel>
                    <Select
                      value={databaseConfig.deltaColumn || ''}
                      onChange={(e) => onDatabaseConfigChange({ ...databaseConfig, deltaColumn: e.target.value })}
                      disabled={!state.tableSchema}
                    >
                      <option value="">Select delta column...</option>
                      {state.tableSchema?.map((col) => (
                        <option key={col.name} value={col.name}>
                          {col.name} ({col.type})
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Column used to track changes (e.g., modified_date, updated_at)
                    </p>
                  </FormField>

                  <FormField>
                    <FormLabel>Last Watermark (Optional)</FormLabel>
                    <Input
                      placeholder="2024-01-01 or leave empty for full load"
                      value={databaseConfig.lastWatermark?.toString() || ''}
                      onChange={(e) => onDatabaseConfigChange({ ...databaseConfig, lastWatermark: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to load all records on first run
                    </p>
                  </FormField>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schema Preview */}
      {state.tableSchema && databaseConfig.tableName && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Schema Preview - {databaseConfig.tableName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {state.isLoadingSchema ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading schema...
              </div>
            ) : state.schemaError ? (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                {state.schemaError}
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground mb-3">
                  Found {state.tableSchema.length} columns
                </p>
                <div className="max-h-64 overflow-y-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Column Name</th>
                        <th className="text-left p-2 font-medium">Data Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.tableSchema.map((col, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 font-mono text-xs">{col.name}</td>
                          <td className="p-2 text-muted-foreground">{col.type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
