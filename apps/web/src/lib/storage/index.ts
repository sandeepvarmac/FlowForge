import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const BRONZE_DIR = process.env.BRONZE_DIR || path.join(process.cwd(), 'data', 'bronze')
const SILVER_DIR = process.env.SILVER_DIR || path.join(process.cwd(), 'data', 'silver')
const GOLD_DIR = process.env.GOLD_DIR || path.join(process.cwd(), 'data', 'gold')

// Ensure all directories exist
[UPLOAD_DIR, BRONZE_DIR, SILVER_DIR, GOLD_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
})

export interface StorageLocation {
  upload: string
  bronze: string
  silver: string
  gold: string
}

/**
 * Get storage paths for a specific job
 */
export function getJobStoragePaths(workflowId: string, jobId: string): StorageLocation {
  return {
    upload: path.join(UPLOAD_DIR, workflowId, jobId),
    bronze: path.join(BRONZE_DIR, workflowId, jobId),
    silver: path.join(SILVER_DIR, workflowId, jobId),
    gold: path.join(GOLD_DIR, workflowId, jobId)
  }
}

/**
 * Save uploaded file
 */
export async function saveUploadedFile(
  workflowId: string,
  jobId: string,
  file: File
): Promise<string> {
  const uploadDir = path.join(UPLOAD_DIR, workflowId, jobId)
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
  }

  const filename = `${Date.now()}_${file.name}`
  const filepath = path.join(uploadDir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  fs.writeFileSync(filepath, buffer)

  console.log('📁 File saved:', filepath)
  return filepath
}

/**
 * Save Parquet file to specific layer
 */
export function saveParquetFile(
  layer: 'bronze' | 'silver' | 'gold',
  workflowId: string,
  jobId: string,
  tableName: string,
  data: Buffer
): string {
  const baseDir = layer === 'bronze' ? BRONZE_DIR : layer === 'silver' ? SILVER_DIR : GOLD_DIR
  const layerDir = path.join(baseDir, workflowId, jobId)

  if (!fs.existsSync(layerDir)) {
    fs.mkdirSync(layerDir, { recursive: true })
  }

  const filename = `${tableName}.parquet`
  const filepath = path.join(layerDir, filename)

  fs.writeFileSync(filepath, data)

  console.log(`📊 ${layer.toUpperCase()} layer saved:`, filepath)
  return filepath
}

/**
 * Read file content
 */
export function readFile(filepath: string): Buffer {
  return fs.readFileSync(filepath)
}

/**
 * Get file hash for caching
 */
export function getFileHash(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Check if file exists
 */
export function fileExists(filepath: string): boolean {
  return fs.existsSync(filepath)
}

/**
 * Get file size
 */
export function getFileSize(filepath: string): number {
  const stats = fs.statSync(filepath)
  return stats.size
}

/**
 * Delete file
 */
export function deleteFile(filepath: string): void {
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath)
    console.log('🗑️  File deleted:', filepath)
  }
}

/**
 * List files in directory
 */
export function listFiles(dirpath: string): string[] {
  if (!fs.existsSync(dirpath)) {
    return []
  }
  return fs.readdirSync(dirpath)
}
