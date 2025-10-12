/**
 * Storage Service Interface - Provider-agnostic storage abstraction
 *
 * This interface provides a clean abstraction over cloud storage providers.
 * Currently implements S3-compatible storage (MinIO/AWS S3).
 * Future: Can add Azure ADLS, GCP GCS, Fabric OneLake adapters.
 */

export interface IStorageService {
  /**
   * Upload a file to storage
   * @param workflowId - Workflow identifier
   * @param jobId - Job identifier
   * @param file - File to upload
   * @returns S3 URI of uploaded file (e.g., s3://bucket/key)
   */
  saveUploadedFile(workflowId: string, jobId: string, file: File): Promise<string>

  /**
   * List files in a storage prefix/folder
   * @param prefix - Folder prefix (e.g., "landing/workflow-id/")
   * @returns Array of file metadata
   */
  listFiles(prefix: string): Promise<Array<{
    key: string
    size: number
    lastModified: Date
  }>>

  /**
   * Get storage provider name for debugging/logging
   */
  getProviderName(): string
}

/**
 * S3-compatible storage service (MinIO, AWS S3, etc.)
 *
 * This adapter wraps the existing storage implementation in index.ts
 * without modifying it, ensuring backward compatibility.
 */
export class S3StorageService implements IStorageService {
  private providerName: string

  constructor(providerName: string = 'minio') {
    this.providerName = providerName
  }

  async saveUploadedFile(workflowId: string, jobId: string, file: File): Promise<string> {
    // Delegate to existing implementation
    const { saveUploadedFile } = await import('./index')
    return saveUploadedFile(workflowId, jobId, file)
  }

  async listFiles(prefix: string) {
    // Delegate to existing implementation
    const { listFiles } = await import('./index')
    return listFiles(prefix)
  }

  getProviderName(): string {
    return this.providerName
  }
}

/**
 * Factory function to create storage service based on configuration
 *
 * Future enhancement: Can read from environment profile to determine
 * which storage provider to use (S3, ADLS, GCS, etc.)
 */
export function createStorageService(): IStorageService {
  // For now, always return S3-compatible service
  // Future: Check environment variable or config file
  const provider = process.env.STORAGE_PROVIDER || 'minio'

  switch (provider) {
    case 'minio':
    case 's3':
      return new S3StorageService(provider)

    // Future providers:
    // case 'adls':
    //   return new ADLSStorageService()
    // case 'gcs':
    //   return new GCSStorageService()

    default:
      console.warn(`Unknown storage provider: ${provider}, defaulting to S3`)
      return new S3StorageService('s3')
  }
}
