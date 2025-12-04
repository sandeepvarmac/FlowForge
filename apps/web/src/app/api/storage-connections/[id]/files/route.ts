import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { S3StorageConfig, LocalStorageConfig, StorageFile, ListFilesResponse } from '@/types/storage-connection'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * GET /api/storage-connections/[id]/files
 * List files in a storage connection
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get('prefix') || ''
    const pattern = searchParams.get('pattern') || '*'

    const db = getDatabase()

    // Fetch connection
    const row = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(id) as any
    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Storage connection not found', files: [], totalFiles: 0 },
        { status: 404 }
      )
    }

    const config = JSON.parse(row.config)
    let result: ListFilesResponse

    // List based on connection type
    switch (row.type) {
      case 'local':
        result = await listLocalFiles(config as LocalStorageConfig, prefix, pattern)
        break
      case 's3':
        result = await listS3Files(config as S3StorageConfig, prefix, pattern)
        break
      default:
        result = {
          success: false,
          error: `Listing not implemented for type: ${row.type}`,
          files: [],
          totalFiles: 0
        }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error listing files:', error)
    return NextResponse.json(
      { success: false, error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`, files: [], totalFiles: 0 },
      { status: 500 }
    )
  }
}

/**
 * List files in local file system
 */
async function listLocalFiles(
  config: LocalStorageConfig,
  prefix: string,
  pattern: string
): Promise<ListFilesResponse> {
  try {
    const basePath = path.join(config.basePath, prefix)

    if (!fs.existsSync(basePath)) {
      return {
        success: false,
        error: `Path does not exist: ${basePath}`,
        files: [],
        totalFiles: 0
      }
    }

    const entries = fs.readdirSync(basePath, { withFileTypes: true })
    const files: StorageFile[] = []

    // Parse comma-separated patterns (e.g., "*.csv,*.json,*.parquet,*.xlsx")
    const extensions = pattern !== '*'
      ? pattern.split(',').map(p => p.trim().replace('*', ''))
      : null

    for (const entry of entries) {
      const fullPath = path.join(basePath, entry.name)

      // Apply pattern filter (skip non-matching files, but always include directories)
      if (extensions && entry.isFile()) {
        const matchesPattern = extensions.some(ext => entry.name.toLowerCase().endsWith(ext.toLowerCase()))
        if (!matchesPattern) {
          continue
        }
      }

      const stats = fs.statSync(fullPath)

      files.push({
        name: entry.name,
        path: path.join(prefix, entry.name),
        size: stats.size,
        lastModified: stats.mtimeMs,
        isDirectory: entry.isDirectory()
      })
    }

    // Sort: directories first, then by name
    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })

    return {
      success: true,
      files,
      totalFiles: files.length
    }
  } catch (error) {
    return {
      success: false,
      error: `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
      files: [],
      totalFiles: 0
    }
  }
}

/**
 * List files in S3/MinIO bucket
 */
async function listS3Files(
  config: S3StorageConfig,
  prefix: string,
  pattern: string
): Promise<ListFilesResponse> {
  return new Promise((resolve) => {
    try {
      const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
      const pythonExecutable = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')

      const pythonCode = `
import sys
import json
import boto3
from botocore.client import Config

try:
    args = json.loads(sys.argv[1])
    config = args['config']
    prefix = args.get('prefix', '')
    pattern = args.get('pattern', '*')

    # Create S3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=config.get('endpointUrl'),
        aws_access_key_id=config.get('accessKeyId'),
        aws_secret_access_key=config.get('secretAccessKey'),
        region_name=config.get('region', 'us-east-1'),
        config=Config(signature_version='s3v4')
    )

    bucket = config.get('bucket')
    full_prefix = config.get('prefix', '') + prefix

    response = s3_client.list_objects_v2(
        Bucket=bucket,
        Prefix=full_prefix,
        MaxKeys=100
    )

    # Parse comma-separated patterns (e.g., "*.csv,*.json,*.parquet,*.xlsx")
    extensions = [p.strip().replace('*', '').lower() for p in pattern.split(',')] if pattern != '*' else None

    files = []
    for obj in response.get('Contents', []):
        key = obj['Key']
        name = key.split('/')[-1] if '/' in key else key

        # Apply pattern filter
        if extensions:
            name_lower = name.lower()
            if not any(name_lower.endswith(ext) for ext in extensions):
                continue

        files.append({
            'name': name,
            'path': key,
            'size': obj['Size'],
            'lastModified': int(obj['LastModified'].timestamp() * 1000),
            'isDirectory': False
        })

    # Check for common prefixes (folders)
    for prefix_obj in response.get('CommonPrefixes', []):
        folder_name = prefix_obj['Prefix'].rstrip('/').split('/')[-1]
        files.append({
            'name': folder_name,
            'path': prefix_obj['Prefix'],
            'size': 0,
            'lastModified': 0,
            'isDirectory': True
        })

    result = {
        'success': True,
        'files': files,
        'totalFiles': len(files)
    }
    print(json.dumps(result))

except Exception as e:
    result = {
        'success': False,
        'error': str(e),
        'files': [],
        'totalFiles': 0
    }
    print(json.dumps(result))
`

      const proc = spawn(pythonExecutable, [
        '-c',
        pythonCode,
        JSON.stringify({ config, prefix, pattern })
      ], {
        cwd: prefectFlowsDir
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0 && stdout) {
          try {
            const result = JSON.parse(stdout.trim())
            resolve(result)
          } catch {
            resolve({
              success: false,
              error: `Failed to parse response: ${stdout}`,
              files: [],
              totalFiles: 0
            })
          }
        } else {
          resolve({
            success: false,
            error: stderr || 'Failed to list S3 files',
            files: [],
            totalFiles: 0
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to execute: ${error.message}`,
          files: [],
          totalFiles: 0
        })
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill()
        resolve({
          success: false,
          error: 'Request timed out after 30 seconds',
          files: [],
          totalFiles: 0
        })
      }, 30000)

    } catch (error) {
      resolve({
        success: false,
        error: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        files: [],
        totalFiles: 0
      })
    }
  })
}
