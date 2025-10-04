import fs from 'fs'
import path from 'path'
import { glob } from 'glob'

export interface ScannedFile {
  filename: string
  filepath: string
  size: number
  modifiedAt: Date
}

/**
 * Scan directory for files matching a pattern
 */
export async function scanFilesWithPattern(
  directory: string,
  pattern: string
): Promise<ScannedFile[]> {
  try {
    // Ensure directory exists
    if (!fs.existsSync(directory)) {
      console.warn(`Directory does not exist: ${directory}`)
      return []
    }

    // Build glob pattern
    const globPattern = path.join(directory, pattern)
    
    // Find matching files
    const files = await glob(globPattern, {
      nodir: true, // Only files, no directories
      absolute: true
    })

    // Get file stats
    const scannedFiles: ScannedFile[] = files.map(filepath => {
      const stats = fs.statSync(filepath)
      return {
        filename: path.basename(filepath),
        filepath,
        size: stats.size,
        modifiedAt: stats.mtime
      }
    })

    // Sort by modified date (newest first)
    scannedFiles.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime())

    console.log(`📁 Found ${scannedFiles.length} files matching pattern: ${pattern}`)
    return scannedFiles
  } catch (error) {
    console.error('Error scanning files:', error)
    return []
  }
}

/**
 * Scan single file
 */
export function scanSingleFile(filepath: string): ScannedFile | null {
  try {
    if (!fs.existsSync(filepath)) {
      console.warn(`File does not exist: ${filepath}`)
      return null
    }

    const stats = fs.statSync(filepath)
    return {
      filename: path.basename(filepath),
      filepath,
      size: stats.size,
      modifiedAt: stats.mtime
    }
  } catch (error) {
    console.error('Error scanning file:', error)
    return null
  }
}

/**
 * Get total size of files in bytes
 */
export function getTotalSize(files: ScannedFile[]): number {
  return files.reduce((total, file) => total + file.size, 0)
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}
