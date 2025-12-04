/**
 * Storage Connection Types
 * Defines types for file & storage source connections (S3/MinIO, Local Path, SFTP, etc.)
 */

export type StorageConnectionType =
  | 'local'      // Local file system or network share
  | 's3'         // Amazon S3 or S3-compatible (MinIO)
  | 'azure-blob' // Azure Blob Storage (Coming Soon)
  | 'sftp'       // SFTP/FTP Server (Coming Soon)
  | 'gcs'        // Google Cloud Storage (Coming Soon)

export interface StorageConnection {
  id: string
  name: string
  description?: string
  type: StorageConnectionType

  // Connection configuration (varies by type)
  config: StorageConnectionConfig

  // Status tracking
  lastTestedAt?: number
  lastTestStatus?: 'success' | 'failed'
  lastTestMessage?: string

  // Timestamps
  createdAt: number
  updatedAt: number
}

// Union type for all storage configs
export type StorageConnectionConfig =
  | LocalStorageConfig
  | S3StorageConfig
  | AzureBlobConfig
  | SftpConfig

// Local file system / Network share
export interface LocalStorageConfig {
  type: 'local'
  basePath: string           // e.g., "C:\Data\Landing" or "\\server\share\data"
  filePattern?: string       // e.g., "*.csv" or "sales_*.parquet"
  recursive?: boolean        // Scan subdirectories
}

// S3 / MinIO configuration
export interface S3StorageConfig {
  type: 's3'
  endpointUrl: string        // e.g., "http://localhost:9000" for MinIO
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  prefix?: string            // Optional path prefix within bucket
  region?: string            // AWS region (optional for MinIO)
  useSSL?: boolean           // Use HTTPS (default: true for S3, false for local MinIO)
}

// Azure Blob Storage (Coming Soon)
export interface AzureBlobConfig {
  type: 'azure-blob'
  connectionString: string
  containerName: string
  prefix?: string
}

// SFTP/FTP Configuration (Coming Soon)
export interface SftpConfig {
  type: 'sftp'
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  basePath: string
}

// API Request types
export interface CreateStorageConnectionRequest {
  name: string
  description?: string
  type: StorageConnectionType
  config: StorageConnectionConfig
}

export interface UpdateStorageConnectionRequest {
  name?: string
  description?: string
  config?: Partial<StorageConnectionConfig>
}

// Test connection response
export interface TestStorageConnectionResponse {
  success: boolean
  message: string
  details?: {
    filesFound?: number
    totalSize?: number
    sampleFiles?: string[]
  }
}

// File listing types (for browsing storage)
export interface StorageFile {
  name: string
  path: string
  size: number
  lastModified: number
  isDirectory: boolean
}

export interface ListFilesResponse {
  success: boolean
  files: StorageFile[]
  totalFiles: number
  error?: string
}
