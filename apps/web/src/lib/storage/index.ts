/**
 * MinIO S3-based file storage utilities
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const rawEndpoint = process.env.S3_ENDPOINT_URL || 'http://localhost:9000'
const endpointUrl = (() => {
  try {
    const parsed = new URL(rawEndpoint)
    if (parsed.hostname === 'localhost' || parsed.hostname === '::1') {
      parsed.hostname = '127.0.0.1'
    }
    return parsed.toString()
  } catch {
    return rawEndpoint
  }
})()

const s3Client = new S3Client({
  endpoint: endpointUrl,
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'prefect',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'prefect123',
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'flowforge-data'

/**
 * Generate landing zone path following best practices:
 * landing/{source_name}/{yyyy/MM/dd}/{timestamp}_{filename}
 *
 * This provides:
 * - Human-readable source name for easy browsing
 * - Date-partitioned for daily processing and cleanup
 * - Timestamp prefix prevents filename collisions
 */
export function generateLandingKey(sourceName: string, filename: string): string {
  const now = new Date()
  const dateFolder = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`
  const timestamp = now.getTime()
  const sanitizedSourceName = sourceName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')

  return `landing/${sanitizedSourceName}/${dateFolder}/${timestamp}_${filename}`
}

/**
 * Upload file to MinIO landing folder
 *
 * @param sourceName - Human-readable source name (e.g., "loan_payments")
 * @param file - File to upload
 * @param bufferOverride - Optional pre-read buffer
 * @returns Object with s3Uri and landingKey
 */
export async function saveUploadedFile(
  sourceName: string,
  file: File,
  bufferOverride?: Buffer
): Promise<{ s3Uri: string; landingKey: string }> {
  console.log(`🔵 === STORAGE FUNCTION CALLED ===`)
  console.log(`🔵 Source Name: ${sourceName}`)
  console.log(`🔵 File name: ${file.name}`)
  console.log(`🔵 File size: ${file.size} bytes`)

  const buffer =
    bufferOverride ?? Buffer.from(await file.arrayBuffer())

  const key = generateLandingKey(sourceName, file.name)

  console.log(`📤 Uploading to S3: ${key} (${buffer.length} bytes)`)
  console.log(`   Endpoint: ${process.env.S3_ENDPOINT_URL || 'http://localhost:9000'}`)
  console.log(`   Bucket: ${BUCKET_NAME}`)

  try {
    const result = await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'text/csv',
      })
    )

    console.log(`✅ Upload successful! ETag: ${result.ETag}`)
    console.log(`✅ Uploaded to MinIO: s3://${BUCKET_NAME}/${key}`)

    return {
      s3Uri: `s3://${BUCKET_NAME}/${key}`,
      landingKey: key,
    }
  } catch (error) {
    console.error(`❌ S3 upload failed:`, error)
    throw error
  }
}

/**
 * Legacy upload function for backward compatibility
 * @deprecated Use saveUploadedFile(sourceName, file) instead
 */
export async function saveUploadedFileLegacy(
  workflowId: string,
  jobId: string,
  file: File,
  bufferOverride?: Buffer
): Promise<string> {
  const buffer = bufferOverride ?? Buffer.from(await file.arrayBuffer())
  const key = `landing/${workflowId}/${jobId}/${file.name}`

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type || 'text/csv',
    })
  )

  return `s3://${BUCKET_NAME}/${key}`
}

/**
 * Get file hash for caching
 */
export function getFileHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

/**
 * List files in a MinIO prefix/folder
 */
export async function listFiles(prefix: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3')

  try {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
    })

    const response = await s3Client.send(command)

    if (!response.Contents) {
      return []
    }

    return response.Contents.map(obj => ({
      key: obj.Key || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
    })).filter(obj => obj.key !== prefix && obj.key !== prefix + '/') // Remove the folder itself
  } catch (error) {
    console.error(`❌ S3 list failed:`, error)
    throw error
  }
}

/**
 * Read file from MinIO (not implemented - use S3Client directly)
 */
export async function readFile(filepath: string): Promise<Buffer> {
  throw new Error('readFile not implemented - use S3Client directly')
}
