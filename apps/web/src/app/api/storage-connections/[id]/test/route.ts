import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { S3StorageConfig, LocalStorageConfig, TestStorageConnectionResponse } from '@/types/storage-connection'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

/**
 * POST /api/storage-connections/[id]/test
 * Test a storage connection
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const db = getDatabase()

    // Fetch connection
    const row = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(id) as any
    if (!row) {
      return NextResponse.json(
        { success: false, error: 'Storage connection not found' },
        { status: 404 }
      )
    }

    const config = JSON.parse(row.config)
    let result: TestStorageConnectionResponse

    // Test based on connection type
    switch (row.type) {
      case 'local':
        result = await testLocalConnection(config as LocalStorageConfig)
        break
      case 's3':
        result = await testS3Connection(config as S3StorageConfig)
        break
      default:
        result = {
          success: false,
          message: `Testing not implemented for type: ${row.type}`
        }
    }

    // Update test status in database
    const now = Date.now()
    db.prepare(`
      UPDATE storage_connections
      SET last_tested_at = ?, last_test_status = ?, last_test_message = ?, updated_at = ?
      WHERE id = ?
    `).run(
      now,
      result.success ? 'success' : 'failed',
      result.message,
      now,
      id
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error testing storage connection:', error)
    return NextResponse.json(
      { success: false, message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * Test local file system connection
 */
async function testLocalConnection(config: LocalStorageConfig): Promise<TestStorageConnectionResponse> {
  try {
    const basePath = config.basePath

    // Check if path exists
    if (!fs.existsSync(basePath)) {
      return {
        success: false,
        message: `Path does not exist: ${basePath}`
      }
    }

    // Check if it's a directory
    const stats = fs.statSync(basePath)
    if (!stats.isDirectory()) {
      return {
        success: false,
        message: `Path is not a directory: ${basePath}`
      }
    }

    // List files in directory
    const files = fs.readdirSync(basePath)
    const filePattern = config.filePattern || '*'

    // Simple pattern matching (supports *.csv, *.parquet, etc.)
    let matchedFiles = files
    if (filePattern !== '*') {
      const extension = filePattern.replace('*', '')
      matchedFiles = files.filter(f => f.endsWith(extension))
    }

    // Get sample file info
    const sampleFiles = matchedFiles.slice(0, 5).map(f => {
      const filePath = path.join(basePath, f)
      const fileStats = fs.statSync(filePath)
      return `${f} (${formatBytes(fileStats.size)})`
    })

    // Calculate total size
    let totalSize = 0
    for (const file of matchedFiles) {
      const filePath = path.join(basePath, file)
      const fileStats = fs.statSync(filePath)
      if (fileStats.isFile()) {
        totalSize += fileStats.size
      }
    }

    return {
      success: true,
      message: `Successfully connected. Found ${matchedFiles.length} files matching pattern "${filePattern}"`,
      details: {
        filesFound: matchedFiles.length,
        totalSize,
        sampleFiles
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to access path: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Test S3/MinIO connection
 */
async function testS3Connection(config: S3StorageConfig): Promise<TestStorageConnectionResponse> {
  return new Promise((resolve) => {
    try {
      // Use Python script to test S3 connection
      const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
      const pythonExecutable = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')

      // Create a simple Python script inline
      const pythonCode = `
import sys
import json
import boto3
from botocore.client import Config

try:
    config = json.loads(sys.argv[1])

    # Create S3 client
    s3_client = boto3.client(
        's3',
        endpoint_url=config.get('endpointUrl'),
        aws_access_key_id=config.get('accessKeyId'),
        aws_secret_access_key=config.get('secretAccessKey'),
        region_name=config.get('region', 'us-east-1'),
        config=Config(signature_version='s3v4')
    )

    # Test by listing bucket contents
    bucket = config.get('bucket')
    prefix = config.get('prefix', '')

    response = s3_client.list_objects_v2(
        Bucket=bucket,
        Prefix=prefix,
        MaxKeys=10
    )

    files_found = response.get('KeyCount', 0)
    sample_files = [obj['Key'] for obj in response.get('Contents', [])][:5]

    result = {
        'success': True,
        'message': f'Successfully connected to bucket "{bucket}". Found {files_found} objects.',
        'details': {
            'filesFound': files_found,
            'sampleFiles': sample_files
        }
    }
    print(json.dumps(result))

except Exception as e:
    result = {
        'success': False,
        'message': f'Connection failed: {str(e)}'
    }
    print(json.dumps(result))
`

      const proc = spawn(pythonExecutable, ['-c', pythonCode, JSON.stringify(config)], {
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
              message: `Failed to parse response: ${stdout}`
            })
          }
        } else {
          resolve({
            success: false,
            message: stderr || 'Failed to test S3 connection'
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          message: `Failed to execute test: ${error.message}`
        })
      })

      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill()
        resolve({
          success: false,
          message: 'Connection test timed out after 30 seconds'
        })
      }, 30000)

    } catch (error) {
      resolve({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  })
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
