"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Badge
} from '@/components/ui'
import { FormField, FormLabel, FormError, Textarea } from '@/components/ui/form'
import { FolderOpen, Cloud, Loader2, CheckCircle, XCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  StorageConnection,
  StorageConnectionType,
  CreateStorageConnectionRequest,
  LocalStorageConfig,
  S3StorageConfig
} from '@/types/storage-connection'

interface CreateStorageConnectionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editConnection?: StorageConnection
  onConnectionCreated?: (connection: StorageConnection, wasEdit: boolean) => void
  onError?: (message: string) => void
  onBack?: () => void
}

// Storage type options
const storageTypes = [
  {
    value: 'local' as StorageConnectionType,
    label: 'Local / Network Path',
    icon: FolderOpen,
    description: 'Local file system or UNC path',
    enabled: true
  },
  {
    value: 's3' as StorageConnectionType,
    label: 'S3 / MinIO',
    icon: Cloud,
    description: 'S3-compatible storage',
    enabled: true
  }
]

export function CreateStorageConnectionModal({
  open,
  onOpenChange,
  editConnection,
  onConnectionCreated,
  onError,
  onBack
}: CreateStorageConnectionModalProps) {
  const [loading, setLoading] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [testResult, setTestResult] = React.useState<{ success: boolean; message: string } | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // Form state
  const [selectedType, setSelectedType] = React.useState<StorageConnectionType>('local')
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')

  // Local config
  const [localBasePath, setLocalBasePath] = React.useState('')
  const [localFilePattern, setLocalFilePattern] = React.useState('*')

  // S3 config
  const [s3Endpoint, setS3Endpoint] = React.useState('')
  const [s3AccessKey, setS3AccessKey] = React.useState('')
  const [s3SecretKey, setS3SecretKey] = React.useState('')
  const [s3Bucket, setS3Bucket] = React.useState('')
  const [s3Prefix, setS3Prefix] = React.useState('')
  const [s3Region, setS3Region] = React.useState('us-east-1')

  const isEditing = !!editConnection

  // Reset form when opening/closing
  React.useEffect(() => {
    if (open) {
      if (editConnection) {
        // Populate form with existing data
        setSelectedType(editConnection.type)
        setName(editConnection.name)
        setDescription(editConnection.description || '')

        if (editConnection.type === 'local') {
          const config = editConnection.config as LocalStorageConfig
          setLocalBasePath(config.basePath || '')
          setLocalFilePattern(config.filePattern || '*')
        } else if (editConnection.type === 's3') {
          const config = editConnection.config as S3StorageConfig
          setS3Endpoint(config.endpointUrl || '')
          setS3AccessKey(config.accessKeyId || '')
          setS3SecretKey(config.secretAccessKey || '')
          setS3Bucket(config.bucket || '')
          setS3Prefix(config.prefix || '')
          setS3Region(config.region || 'us-east-1')
        }
      } else {
        resetForm()
      }
    }
  }, [open, editConnection])

  const resetForm = () => {
    setSelectedType('local')
    setName('')
    setDescription('')
    setLocalBasePath('')
    setLocalFilePattern('*')
    setS3Endpoint('')
    setS3AccessKey('')
    setS3SecretKey('')
    setS3Bucket('')
    setS3Prefix('')
    setS3Region('us-east-1')
    setErrors({})
    setTestResult(null)
  }

  const handleClose = () => {
    resetForm()
    onOpenChange(false)
  }

  const handleTypeChange = (type: StorageConnectionType) => {
    setSelectedType(type)
    setTestResult(null)

    // Set default values for MinIO if S3 selected
    if (type === 's3' && !s3Endpoint) {
      setS3Endpoint('http://localhost:9000')
      setS3Bucket('flowforge-data')
      setS3AccessKey('minioadmin')
      setS3SecretKey('minioadmin123')
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Connection name is required'
    }

    if (!selectedType) {
      newErrors.type = 'Storage type is required'
    }

    if (selectedType === 'local') {
      if (!localBasePath.trim()) {
        newErrors.basePath = 'Base path is required'
      }
    } else if (selectedType === 's3') {
      if (!s3Endpoint.trim()) {
        newErrors.endpoint = 'Endpoint URL is required'
      }
      if (!s3AccessKey.trim()) {
        newErrors.accessKey = 'Access Key is required'
      }
      if (!s3SecretKey.trim()) {
        newErrors.secretKey = 'Secret Key is required'
      }
      if (!s3Bucket.trim()) {
        newErrors.bucket = 'Bucket name is required'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const buildConfig = (): LocalStorageConfig | S3StorageConfig => {
    if (selectedType === 'local') {
      return {
        type: 'local',
        basePath: localBasePath,
        filePattern: localFilePattern || '*'
      }
    } else {
      return {
        type: 's3',
        endpointUrl: s3Endpoint,
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
        bucket: s3Bucket,
        prefix: s3Prefix || undefined,
        region: s3Region || 'us-east-1'
      }
    }
  }

  const handleTestConnection = async () => {
    if (!validateForm()) return

    setTesting(true)
    setTestResult(null)

    try {
      // Test connection without saving using the test-only endpoint
      const config = buildConfig()

      const testResponse = await fetch('/api/storage-connections/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          config
        })
      })

      const testData = await testResponse.json()
      setTestResult({
        success: testData.success,
        message: testData.message
      })

      // Don't save or close - just show the test result
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Test failed'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setLoading(true)

    try {
      const config = buildConfig()

      if (isEditing) {
        // Update existing connection
        const response = await fetch(`/api/storage-connections/${editConnection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, config })
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to update connection')
        }

        const data = await response.json()
        onConnectionCreated?.(data.connection, true)
      } else {
        // Create new connection
        const response = await fetch('/api/storage-connections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description,
            type: selectedType,
            config
          } as CreateStorageConnectionRequest)
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to create connection')
        }

        const data = await response.json()
        onConnectionCreated?.(data.connection, false)
      }

      handleClose()
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Failed to save connection')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="2xl" className="max-h-[95vh] max-w-[95vw] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Edit Storage Connection' : 'Create Storage Connection'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the storage connection details. Connection will be tested on save.'
              : 'Create a reusable storage connection that can be used across multiple jobs'
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Production Landing Zone"
                autoFocus
              />
              <FormError>{errors.name}</FormError>
            </FormField>

            <FormField>
              <FormLabel>Description</FormLabel>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this connection"
                rows={2}
              />
            </FormField>
          </div>

          {/* Storage Type */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-foreground border-b pb-2">Storage Type</h3>

            <div className="grid grid-cols-2 gap-3">
              {storageTypes.map((type) => {
                const Icon = type.icon
                const isSelected = selectedType === type.value
                const isDisabled = !type.enabled

                return (
                  <button
                    key={type.value}
                    type="button"
                    onClick={() => !isDisabled && handleTypeChange(type.value)}
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
                      <span className="font-semibold text-sm">{type.label}</span>
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {type.description}
                    </p>
                  </button>
                )
              })}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  This connection will be automatically tested when you create it to ensure the path or credentials are valid
                </p>
              </div>
            </div>
          </div>

          {/* Local Path Configuration */}
          {selectedType === 'local' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground border-b pb-2">Path Configuration</h3>

              <FormField>
                <FormLabel required>Base Path</FormLabel>
                <Input
                  value={localBasePath}
                  onChange={(e) => setLocalBasePath(e.target.value)}
                  placeholder="e.g., C:\Data\Landing or \\server\share\data"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Enter a local directory or UNC network path
                </p>
                <FormError>{errors.basePath}</FormError>
              </FormField>

              <FormField>
                <FormLabel>File Pattern</FormLabel>
                <Input
                  value={localFilePattern}
                  onChange={(e) => setLocalFilePattern(e.target.value)}
                  placeholder="e.g., *.csv or *.parquet"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Filter files by extension (use * for all files)
                </p>
              </FormField>
            </div>
          )}

          {/* S3/MinIO Configuration */}
          {selectedType === 's3' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-semibold text-foreground">S3 Configuration</h3>
                <Badge variant="secondary" className="text-xs">MinIO Compatible</Badge>
              </div>

              <FormField>
                <FormLabel required>Endpoint URL</FormLabel>
                <Input
                  value={s3Endpoint}
                  onChange={(e) => setS3Endpoint(e.target.value)}
                  placeholder="e.g., http://localhost:9000 or https://s3.amazonaws.com"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  For MinIO use http://localhost:9000, for AWS S3 use https://s3.amazonaws.com
                </p>
                <FormError>{errors.endpoint}</FormError>
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField>
                  <FormLabel required>Access Key ID</FormLabel>
                  <Input
                    value={s3AccessKey}
                    onChange={(e) => setS3AccessKey(e.target.value)}
                    placeholder="e.g., minioadmin"
                  />
                  <FormError>{errors.accessKey}</FormError>
                </FormField>

                <FormField>
                  <FormLabel required>Secret Access Key</FormLabel>
                  <Input
                    type="password"
                    value={s3SecretKey}
                    onChange={(e) => setS3SecretKey(e.target.value)}
                    placeholder="••••••••"
                  />
                  <FormError>{errors.secretKey}</FormError>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField>
                  <FormLabel required>Bucket Name</FormLabel>
                  <Input
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                    placeholder="e.g., flowforge-data"
                  />
                  <FormError>{errors.bucket}</FormError>
                </FormField>

                <FormField>
                  <FormLabel>Region</FormLabel>
                  <Input
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                    placeholder="e.g., us-east-1"
                  />
                </FormField>
              </div>

              <FormField>
                <FormLabel>Path Prefix</FormLabel>
                <Input
                  value={s3Prefix}
                  onChange={(e) => setS3Prefix(e.target.value)}
                  placeholder="e.g., landing/sales/"
                />
                <p className="text-xs text-foreground-muted mt-1">
                  Optional path prefix within the bucket
                </p>
              </FormField>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className={cn(
              'p-4 rounded-lg border',
              testResult.success
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            )}>
              <div className="flex items-start gap-2">
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
          <div className="flex justify-between w-full">
            <div>
              {onBack && !isEditing && (
                <Button variant="outline" onClick={onBack} disabled={loading || testing}>
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={handleClose} disabled={loading || testing}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={loading || testing}
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button onClick={handleSubmit} disabled={loading || testing}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {isEditing ? 'Update Connection' : 'Create Connection'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
