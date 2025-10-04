import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR: string = process.env.UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads')
const BRONZE_DIR: string = process.env.BRONZE_DIR || path.join(process.cwd(), 'data', 'bronze')
const SILVER_DIR: string = process.env.SILVER_DIR || path.join(process.cwd(), 'data', 'silver')
const GOLD_DIR: string = process.env.GOLD_DIR || path.join(process.cwd(), 'data', 'gold')

// Ensure all directories exist
const dirs = [UPLOAD_DIR, BRONZE_DIR, SILVER_DIR, GOLD_DIR]
dirs.forEach(dir => {
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
 * Generate timestamp for file versioning
 */
export function getTimestamp(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}${month}${day}_${hours}${minutes}${seconds}`
}

/**
 * Save Parquet file to specific layer with versioning
 */
export function saveParquetFile(
  layer: 'bronze' | 'silver' | 'gold',
  workflowId: string,
  jobId: string,
  tableName: string,
  data: Buffer,
  options: {
    versioningStrategy?: 'timestamp' | 'overwrite' | 'current'
    executionId?: string
  } = {}
): string {
  const { versioningStrategy = 'timestamp', executionId } = options
  const baseDir = layer === 'bronze' ? BRONZE_DIR : layer === 'silver' ? SILVER_DIR : GOLD_DIR

  // Bronze: timestamp-based versioning (default)
  // Silver: current + archive
  // Gold: DuckDB (handled separately)

  let filepath: string

  if (layer === 'bronze' && versioningStrategy === 'timestamp') {
    // Bronze: versioned files with timestamp
    const tableDir = path.join(baseDir, workflowId, jobId, tableName)
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true })
    }
    const timestamp = getTimestamp()
    const filename = `run_${timestamp}_${tableName}.parquet`
    filepath = path.join(tableDir, filename)
  } else if (layer === 'silver' && versioningStrategy === 'current') {
    // Silver: current.parquet + archive snapshots
    const tableDir = path.join(baseDir, workflowId, jobId, tableName)
    if (!fs.existsSync(tableDir)) {
      fs.mkdirSync(tableDir, { recursive: true })
    }

    // Archive current file if it exists
    const currentPath = path.join(tableDir, 'current.parquet')
    if (fs.existsSync(currentPath)) {
      const archiveDir = path.join(tableDir, 'archive')
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true })
      }
      const timestamp = getTimestamp()
      const archivePath = path.join(archiveDir, `snapshot_${timestamp}.parquet`)
      fs.renameSync(currentPath, archivePath)
      console.log(`📦 Archived previous version: ${archivePath}`)
    }

    filepath = currentPath
  } else {
    // Default: overwrite mode
    const layerDir = path.join(baseDir, workflowId, jobId)
    if (!fs.existsSync(layerDir)) {
      fs.mkdirSync(layerDir, { recursive: true })
    }
    const filename = `${tableName}.parquet`
    filepath = path.join(layerDir, filename)
  }

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

/**
 * Get latest Bronze file for a table
 */
export function getLatestBronzeFile(
  workflowId: string,
  jobId: string,
  tableName: string
): string | null {
  const tableDir = path.join(BRONZE_DIR, workflowId, jobId, tableName)
  if (!fs.existsSync(tableDir)) {
    return null
  }

  const files = fs.readdirSync(tableDir)
    .filter(f => f.startsWith('run_') && f.endsWith('.parquet'))
    .sort()
    .reverse() // Latest first

  return files.length > 0 ? path.join(tableDir, files[0]) : null
}

/**
 * Get current Silver file for a table
 */
export function getCurrentSilverFile(
  workflowId: string,
  jobId: string,
  tableName: string
): string | null {
  const filepath = path.join(SILVER_DIR, workflowId, jobId, tableName, 'current.parquet')
  return fs.existsSync(filepath) ? filepath : null
}

/**
 * List all Bronze versions for a table
 */
export function listBronzeVersions(
  workflowId: string,
  jobId: string,
  tableName: string
): Array<{ filename: string; path: string; timestamp: string; size: number }> {
  const tableDir = path.join(BRONZE_DIR, workflowId, jobId, tableName)
  if (!fs.existsSync(tableDir)) {
    return []
  }

  return fs.readdirSync(tableDir)
    .filter(f => f.startsWith('run_') && f.endsWith('.parquet'))
    .map(filename => {
      const filepath = path.join(tableDir, filename)
      const stats = fs.statSync(filepath)
      // Extract timestamp from filename: run_YYYYMMDD_HHMMSS_table.parquet
      const match = filename.match(/run_(\d{8}_\d{6})_/)
      const timestamp = match ? match[1] : 'unknown'
      return {
        filename,
        path: filepath,
        timestamp,
        size: stats.size
      }
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)) // Latest first
}
