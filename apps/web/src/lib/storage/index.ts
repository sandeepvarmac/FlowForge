/**
 * MinIO S3-based file storage utilities
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import crypto from 'crypto'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT_URL || 'http://localhost:9000',
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID || 'prefect',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'prefect123',
  },
  forcePathStyle: true,
})

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'flowforge-data'

/**
 * Upload file to MinIO landing folder
 */
export async function saveUploadedFile(
  workflowId: string,
  jobId: string,
  file: File
): Promise<string> {
  console.log(`🔵 === STORAGE FUNCTION CALLED ===`)
  console.log(`🔵 Workflow ID: ${workflowId}`)
  console.log(`🔵 Job ID: ${jobId}`)
  console.log(`🔵 File name: ${file.name}`)
  console.log(`🔵 File size: ${file.size} bytes`)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const key = `landing/${workflowId}/${jobId}/${file.name}`

  console.log(`📤 Uploading to S3: ${key} (${buffer.length} bytes)`)
  console.log(`   Endpoint: ${process.env.S3_ENDPOINT_URL || 'http://localhost:9000'}`)
  console.log(`   Bucket: ${BUCKET_NAME}`)
  console.log(`   Access Key: ${(process.env.S3_ACCESS_KEY_ID || 'prefect').substring(0, 3)}***`)

  try {
    console.log(`🔵 About to call S3Client.send()...`)
    const result = await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: file.type,
      })
    )

    console.log(`✅ S3Client.send() returned successfully!`)
    console.log(`✅ Upload successful! ETag: ${result.ETag}`)
    console.log(`✅ Uploaded to MinIO: s3://${BUCKET_NAME}/${key}`)

    return `s3://${BUCKET_NAME}/${key}`
  } catch (error) {
    console.error(`❌ S3 upload failed:`, error)
    throw error
  }
}

/**
 * Get file hash for caching
 */
export function getFileHash(buffer: Buffer): string {
  return crypto.createHash('md5').update(buffer).digest('hex')
}

/**
 * Read file from MinIO (not implemented - use S3Client directly)
 */
export async function readFile(filepath: string): Promise<Buffer> {
  throw new Error('readFile not implemented - use S3Client directly')
}
