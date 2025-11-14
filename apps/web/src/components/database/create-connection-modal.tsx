'use client'

import * as React from 'react'
import { Button, Badge, Input } from '@/components/ui'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormField, FormLabel, FormError, Textarea } from '@/components/ui/form'
import { Database, Loader2, CheckCircle, XCircle, Eye, EyeOff, Info } from 'lucide-react'
import { DatabaseType, CreateConnectionInput, DatabaseConnection } from '@/types/database-connection'
import { cn } from '@/lib/utils'

interface CreateConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editConnection?: DatabaseConnection
  onConnectionCreated?: (connection: any, wasEdit: boolean) => void
  onError?: (message: string) => void
}

interface ConnectionFormData {
  name: string
  description: string
  type: DatabaseType
  host: string
  port: number
  database: string
  username: string
  password: string
  sslEnabled: boolean
  connectionTimeout: number
}

const initialFormData: ConnectionFormData = {
  name: '',
  description: '',
  type: 'sql-server',
  host: '',
  port: 1433,
  database: '',
  username: '',
  password: '',
  sslEnabled: false,
  connectionTimeout: 30
}

const databaseTypes = [
  { value: 'sql-server', label: 'SQL Server', icon: Database, defaultPort: 1433 },
  { value: 'postgresql', label: 'PostgreSQL', icon: Database, defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', icon: Database, defaultPort: 3306 },
  { value: 'oracle', label: 'Oracle', icon: Database, defaultPort: 1521, disabled: true }
]

export function CreateConnectionModal({ open, onOpenChange, editConnection, onConnectionCreated, onError }: CreateConnectionModalProps) {
  const [formData, setFormData] = React.useState<ConnectionFormData>(initialFormData)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [isCreating, setIsCreating] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const [showPassword, setShowPassword] = React.useState(false)

  const isEditMode = !!editConnection

  React.useEffect(() => {
    if (open && editConnection) {
      // Pre-fill form with edit data (but never pre-fill password for security)
      setFormData({
        name: editConnection.name,
        description: editConnection.description || '',
        type: editConnection.type as DatabaseType,
        host: editConnection.host,
        port: editConnection.port,
        database: editConnection.database,
        username: editConnection.username,
        password: '', // Always blank for security
        sslEnabled: editConnection.sslEnabled || false,
        connectionTimeout: editConnection.connectionTimeout || 30
      })
    } else if (!open) {
      // Reset form when modal closes
      setFormData(initialFormData)
      setErrors({})
      setTestResult(null)
      setShowPassword(false)
    }
  }, [open, editConnection])

  const updateFormData = (updates: Partial<ConnectionFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
    // Clear related errors
    const newErrors = { ...errors }
    Object.keys(updates).forEach(key => {
      delete newErrors[key]
    })
    setErrors(newErrors)
  }

  const handleTypeChange = (type: DatabaseType) => {
    const dbType = databaseTypes.find(t => t.value === type)
    updateFormData({
      type,
      port: dbType?.defaultPort || 1433
    })
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) newErrors.name = 'Connection name is required'
    if (!formData.host.trim()) newErrors.host = 'Host is required'
    if (!formData.port || formData.port < 1 || formData.port > 65535) newErrors.port = 'Valid port number is required'
    if (!formData.database.trim()) newErrors.database = 'Database name is required'
    if (!formData.username.trim()) newErrors.username = 'Username is required'
    // Password is always required (both create and edit)
    if (!formData.password.trim()) newErrors.password = 'Password is required'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreateConnection = async () => {
    if (!validateForm()) return

    try {
      setIsCreating(true)
      setTestResult(null)

      const input: CreateConnectionInput = {
        name: formData.name,
        description: formData.description || undefined,
        type: formData.type,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
        sslEnabled: formData.sslEnabled,
        connectionTimeout: formData.connectionTimeout
      }

      const url = isEditMode
        ? `/api/database-connections/${editConnection.id}`
        : '/api/database-connections'

      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })

      const data = await response.json()

      if (data.success) {
        // Clear test result from modal
        setTestResult(null)

        // Close modal and notify parent
        onConnectionCreated?.(data.connection, isEditMode)
        onOpenChange(false)
      } else {
        // Show error in modal
        setTestResult({
          success: false,
          message: data.message || (isEditMode ? 'Failed to update connection' : 'Failed to create connection')
        })

        // Also show toast error
        const errorMessage = data.testResult?.message || data.message || (isEditMode ? 'Failed to update connection. Please check your credentials.' : 'Failed to create connection. Please check your credentials.')
        onError?.(errorMessage)
      }
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} connection:`, error)
      const errorMessage = 'An unexpected error occurred. Please try again.'
      setTestResult({
        success: false,
        message: errorMessage
      })
      onError?.(errorMessage)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setErrors({})
    setTestResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Database Connection' : 'Create Database Connection'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the database connection details. Connection will be tested on save.'
              : 'Create a reusable database connection that can be used across multiple jobs'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Basic Information</h3>

            <FormField>
              <FormLabel required>Connection Name</FormLabel>
              <Input
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="e.g., Production SQL Server"
                autoFocus
              />
              <FormError>{errors.name}</FormError>
            </FormField>

            <FormField>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                placeholder="Optional description of this connection"
                rows={2}
              />
            </FormField>
          </div>

          {/* Database Type */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Database Type</h3>

            <div className="grid grid-cols-2 gap-3">
              {databaseTypes.map((dbType) => {
                const Icon = dbType.icon
                const isSelected = formData.type === dbType.value
                const isDisabled = dbType.disabled

                return (
                  <button
                    key={dbType.value}
                    type="button"
                    onClick={() => !isDisabled && handleTypeChange(dbType.value as DatabaseType)}
                    disabled={isDisabled}
                    className={cn(
                      'p-4 border-2 rounded-lg text-left transition-all relative',
                      isSelected
                        ? 'border-primary bg-primary-50 shadow-md ring-2 ring-primary ring-opacity-50'
                        : isDisabled
                        ? 'border-border bg-gray-50 opacity-50 cursor-not-allowed'
                        : 'border-border hover:border-primary-300 cursor-pointer'
                    )}
                  >
                    {isDisabled && (
                      <Badge className="absolute top-2 right-2 text-[10px]" variant="secondary">
                        Coming Soon
                      </Badge>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className={cn('w-4 h-4', isSelected ? 'text-primary' : 'text-foreground-muted')} />
                      <span className="font-semibold text-sm">{dbType.label}</span>
                    </div>
                    <p className="text-xs text-foreground-muted">
                      Default port: {dbType.defaultPort}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  This connection will be automatically tested when you create it to ensure credentials are valid
                </p>
              </div>
            </div>
          </div>

          {/* Connection Details */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Connection Details</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel required>Host</FormLabel>
                <Input
                  value={formData.host}
                  onChange={(e) => updateFormData({ host: e.target.value })}
                  placeholder="e.g., localhost or 192.168.1.100"
                />
                <FormError>{errors.host}</FormError>
              </FormField>

              <FormField>
                <FormLabel required>Port</FormLabel>
                <Input
                  type="number"
                  value={formData.port}
                  onChange={(e) => updateFormData({ port: parseInt(e.target.value) || 0 })}
                  placeholder="1433"
                />
                <FormError>{errors.port}</FormError>
              </FormField>
            </div>

            <FormField>
              <FormLabel required>Database Name</FormLabel>
              <Input
                value={formData.database}
                onChange={(e) => updateFormData({ database: e.target.value })}
                placeholder="e.g., MyDatabase"
              />
              <FormError>{errors.database}</FormError>
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel required>Username</FormLabel>
                <Input
                  value={formData.username}
                  onChange={(e) => updateFormData({ username: e.target.value })}
                  placeholder="e.g., sa or admin"
                />
                <FormError>{errors.username}</FormError>
              </FormField>

              <FormField>
                <FormLabel required>Password</FormLabel>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => updateFormData({ password: e.target.value })}
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <FormError>{errors.password}</FormError>
              </FormField>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Advanced Settings</h3>

            <div className="grid grid-cols-2 gap-4">
              <FormField>
                <FormLabel>Connection Timeout (seconds)</FormLabel>
                <Input
                  type="number"
                  value={formData.connectionTimeout}
                  onChange={(e) => updateFormData({ connectionTimeout: parseInt(e.target.value) || 30 })}
                  placeholder="30"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  <Info className="w-3 h-3 inline mr-1" />
                  How long to wait before timing out
                </p>
              </FormField>

              <FormField>
                <FormLabel>SSL/TLS Encryption</FormLabel>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="ssl-enabled"
                    checked={formData.sslEnabled}
                    onChange={(e) => updateFormData({ sslEnabled: e.target.checked })}
                    className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
                  />
                  <label htmlFor="ssl-enabled" className="text-sm text-foreground">
                    Enable SSL/TLS encryption
                  </label>
                </div>
                <p className="text-xs text-foreground-muted mt-1">
                  <Info className="w-3 h-3 inline mr-1" />
                  Recommended for production environments
                </p>
              </FormField>
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div className={cn(
              'p-4 rounded-lg border',
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-start gap-3">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div>
                  <h4 className={cn(
                    'text-sm font-semibold',
                    testResult.success ? 'text-green-900' : 'text-red-900'
                  )}>
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </h4>
                  <p className={cn(
                    'text-sm mt-1',
                    testResult.success ? 'text-green-700' : 'text-red-700'
                  )}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateConnection}
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {isEditMode ? 'Updating & Testing...' : 'Creating & Testing...'}
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                {isEditMode ? 'Update Connection' : 'Create Connection'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
