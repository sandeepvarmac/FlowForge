import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { S3StorageConfig, LocalStorageConfig } from '@/types/storage-connection'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

interface SchemaColumn {
  name: string
  type: string
  nullable: boolean
  sample?: string
}

interface PreviewResponse {
  success: boolean
  error?: string
  schema?: SchemaColumn[]
  preview?: Record<string, any>[]
  metadata?: {
    rowCount: number
    fileSize: number
    hasHeader: boolean
    delimiter?: string
    temporal_columns?: string[]
    pk_candidates?: string[]
  }
}

/**
 * POST /api/storage-connections/[id]/preview
 * Read a file from storage and return schema + preview data
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const { filePath, maxRows = 100 } = body

    if (!filePath) {
      return NextResponse.json(
        { success: false, error: 'File path is required' },
        { status: 400 }
      )
    }

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
    let result: PreviewResponse

    // Read based on connection type
    switch (row.type) {
      case 'local':
        result = await previewLocalFile(config as LocalStorageConfig, filePath, maxRows)
        break
      case 's3':
        result = await previewS3File(config as S3StorageConfig, filePath, maxRows)
        break
      default:
        result = {
          success: false,
          error: `Preview not implemented for type: ${row.type}`
        }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error previewing file:', error)
    return NextResponse.json(
      { success: false, error: `Failed to preview file: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

/**
 * Preview a local file
 */
async function previewLocalFile(
  config: LocalStorageConfig,
  filePath: string,
  maxRows: number
): Promise<PreviewResponse> {
  try {
    const fullPath = path.join(config.basePath, filePath)

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: `File not found: ${filePath}`
      }
    }

    const stats = fs.statSync(fullPath)
    const ext = path.extname(filePath).toLowerCase()

    // Use Python for robust CSV/file parsing with schema detection
    return await parseFileWithPython(fullPath, ext, maxRows, stats.size)
  } catch (error) {
    return {
      success: false,
      error: `Failed to preview file: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
  }
}

/**
 * Preview an S3 file
 */
async function previewS3File(
  config: S3StorageConfig,
  filePath: string,
  maxRows: number
): Promise<PreviewResponse> {
  return new Promise((resolve) => {
    try {
      const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
      const pythonExecutable = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')

      const pythonCode = `
import sys
import json
import boto3
import pandas as pd
import io
from botocore.client import Config

try:
    args = json.loads(sys.argv[1])
    config = args['config']
    file_path = args['file_path']
    max_rows = args.get('max_rows', 100)

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

    # Download file to memory
    response = s3_client.get_object(Bucket=bucket, Key=file_path)
    file_content = response['Body'].read()
    file_size = response['ContentLength']

    # Determine file type
    ext = file_path.lower().split('.')[-1] if '.' in file_path else ''

    # Parse based on extension
    if ext == 'csv':
        df = pd.read_csv(io.BytesIO(file_content), nrows=max_rows)
    elif ext == 'json':
        df = pd.read_json(io.BytesIO(file_content))
        df = df.head(max_rows)
    elif ext == 'parquet':
        df = pd.read_parquet(io.BytesIO(file_content))
        df = df.head(max_rows)
    elif ext in ['xlsx', 'xls']:
        df = pd.read_excel(io.BytesIO(file_content), nrows=max_rows)
    else:
        print(json.dumps({
            'success': False,
            'error': f'Unsupported file type: {ext}'
        }))
        sys.exit(0)

    # Build schema
    schema = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = str(df[col].iloc[0]) if len(df) > 0 else None
        schema.append({
            'name': col,
            'type': dtype,
            'nullable': bool(df[col].isna().any()),
            'sample': sample[:100] if sample else None
        })

    # Detect temporal columns and PK candidates
    temporal_columns = []
    pk_candidates = []

    for col in df.columns:
        col_lower = col.lower()
        dtype = str(df[col].dtype)

        # Temporal detection
        if 'date' in dtype or 'datetime' in dtype:
            temporal_columns.append(col)
        elif any(t in col_lower for t in ['date', 'time', 'created', 'updated', 'modified', 'timestamp']):
            temporal_columns.append(col)

        # PK candidate detection
        if df[col].nunique() == len(df) and not df[col].isna().any():
            pk_candidates.append(col)
        elif any(k in col_lower for k in ['_id', 'id', 'key', 'code']) and df[col].nunique() > len(df) * 0.9:
            pk_candidates.append(col)

    # Convert preview data
    preview = df.head(max_rows).to_dict(orient='records')

    # Convert any non-serializable types (including numpy types)
    import numpy as np
    for row in preview:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif isinstance(value, (np.bool_, np.integer, np.floating)):
                row[key] = value.item()  # Convert numpy scalar to Python native type
            elif hasattr(value, 'isoformat'):
                row[key] = value.isoformat()
            elif not isinstance(value, (str, int, float, bool, type(None))):
                row[key] = str(value)

    result = {
        'success': True,
        'schema': schema,
        'preview': preview,
        'metadata': {
            'rowCount': len(df),
            'fileSize': file_size,
            'hasHeader': True,
            'temporal_columns': temporal_columns,
            'pk_candidates': pk_candidates
        }
    }
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e)
    }))
`

      const proc = spawn(pythonExecutable, [
        '-c',
        pythonCode,
        JSON.stringify({ config, file_path: filePath, max_rows: maxRows })
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
              error: `Failed to parse response: ${stdout}`
            })
          }
        } else {
          resolve({
            success: false,
            error: stderr || 'Failed to preview S3 file'
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to execute: ${error.message}`
        })
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        proc.kill()
        resolve({
          success: false,
          error: 'Request timed out after 60 seconds'
        })
      }, 60000)

    } catch (error) {
      resolve({
        success: false,
        error: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  })
}

/**
 * Parse file with Python for robust schema detection
 */
async function parseFileWithPython(
  fullPath: string,
  ext: string,
  maxRows: number,
  fileSize: number
): Promise<PreviewResponse> {
  return new Promise((resolve) => {
    try {
      const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
      const pythonExecutable = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')

      const pythonCode = `
import sys
import json
import pandas as pd

try:
    args = json.loads(sys.argv[1])
    file_path = args['file_path']
    ext = args['ext']
    max_rows = args.get('max_rows', 100)
    file_size = args.get('file_size', 0)

    # Parse based on extension
    if ext == '.csv':
        df = pd.read_csv(file_path, nrows=max_rows)
    elif ext == '.json':
        df = pd.read_json(file_path)
        df = df.head(max_rows)
    elif ext == '.parquet':
        df = pd.read_parquet(file_path)
        df = df.head(max_rows)
    elif ext in ['.xlsx', '.xls']:
        df = pd.read_excel(file_path, nrows=max_rows)
    else:
        print(json.dumps({
            'success': False,
            'error': f'Unsupported file type: {ext}'
        }))
        sys.exit(0)

    # Build schema
    schema = []
    for col in df.columns:
        dtype = str(df[col].dtype)
        sample = str(df[col].iloc[0]) if len(df) > 0 else None
        schema.append({
            'name': col,
            'type': dtype,
            'nullable': bool(df[col].isna().any()),
            'sample': sample[:100] if sample else None
        })

    # Detect temporal columns and PK candidates
    temporal_columns = []
    pk_candidates = []

    for col in df.columns:
        col_lower = col.lower()
        dtype = str(df[col].dtype)

        # Temporal detection
        if 'date' in dtype or 'datetime' in dtype:
            temporal_columns.append(col)
        elif any(t in col_lower for t in ['date', 'time', 'created', 'updated', 'modified', 'timestamp']):
            temporal_columns.append(col)

        # PK candidate detection
        if df[col].nunique() == len(df) and not df[col].isna().any():
            pk_candidates.append(col)
        elif any(k in col_lower for k in ['_id', 'id', 'key', 'code']) and df[col].nunique() > len(df) * 0.9:
            pk_candidates.append(col)

    # Convert preview data
    preview = df.head(max_rows).to_dict(orient='records')

    # Convert any non-serializable types (including numpy types)
    import numpy as np
    for row in preview:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
            elif isinstance(value, (np.bool_, np.integer, np.floating)):
                row[key] = value.item()  # Convert numpy scalar to Python native type
            elif hasattr(value, 'isoformat'):
                row[key] = value.isoformat()
            elif not isinstance(value, (str, int, float, bool, type(None))):
                row[key] = str(value)

    result = {
        'success': True,
        'schema': schema,
        'preview': preview,
        'metadata': {
            'rowCount': len(df),
            'fileSize': file_size,
            'hasHeader': True,
            'temporal_columns': temporal_columns,
            'pk_candidates': pk_candidates
        }
    }
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e)
    }))
`

      const proc = spawn(pythonExecutable, [
        '-c',
        pythonCode,
        JSON.stringify({ file_path: fullPath, ext, max_rows: maxRows, file_size: fileSize })
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
              error: `Failed to parse response: ${stdout}`
            })
          }
        } else {
          resolve({
            success: false,
            error: stderr || 'Failed to preview file'
          })
        }
      })

      proc.on('error', (error) => {
        resolve({
          success: false,
          error: `Failed to execute: ${error.message}`
        })
      })

      // Timeout after 60 seconds
      setTimeout(() => {
        proc.kill()
        resolve({
          success: false,
          error: 'Request timed out after 60 seconds'
        })
      }, 60000)

    } catch (error) {
      resolve({
        success: false,
        error: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
    }
  })
}
