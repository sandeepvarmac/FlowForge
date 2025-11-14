import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { spawn } from 'child_process'
import path from 'path'

/**
 * GET /api/database-connections/[connectionId]/tables/[tableName]?action=schema|preview
 * Get table schema or preview data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string; tableName: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') || 'schema'
    const limit = parseInt(searchParams.get('limit') || '100')

    const db = getDatabase()

    // Get connection details
    const connection = db.prepare(`
      SELECT id, name, type, host, port, database, username, password
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as any

    if (!connection) {
      return NextResponse.json(
        { success: false, error: 'Connection not found' },
        { status: 404 }
      )
    }

    const connectionConfig = {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password
    }

  if (action === 'preview') {
      // Get table preview (schema + sample data)
      const result = await previewDatabaseTable(
        connection.type,
        connectionConfig,
        params.tableName,
        limit
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to preview table' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        table_name: params.tableName,
        schema: normalizeSchema(result.schema),
        rows: result.rows,
        total_rows: result.total_rows,
        row_count: result.row_count,
        connection: {
          id: connection.id,
          name: connection.name,
          database: connection.database
        }
      })

    } else {
      // Get table schema only
      const result = await getDatabaseSchema(
        connection.type,
        connectionConfig,
        params.tableName
      )

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Failed to get schema' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        table_name: params.tableName,
        schema: normalizeSchema(result.schema),
        row_count: result.row_count,
        preview: result.preview || [], // Include preview data from Python
        metadata: result.metadata || { temporal_columns: [], pk_candidates: [] }, // Include AI metadata
        connection: {
          id: connection.id,
          name: connection.name,
          database: connection.database
        }
      })
    }

  } catch (error: any) {
    console.error('Failed to process table request:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Map Python connector schema -> UI expected schema
function normalizeSchema(schema: any[] | undefined): Array<{ name: string; type: string; nullable: boolean }>{
  if (!Array.isArray(schema)) return []
  return schema.map((col: any) => ({
    name: col.name ?? col.column_name ?? col.columnName ?? '',
    type: col.type ?? col.data_type ?? col.dataType ?? '',
    nullable: (col.nullable ?? col.is_nullable ?? false) === true || (col.is_nullable === 'YES')
  }))
}

// Helper function to get database schema
async function getDatabaseSchema(
  dbType: string,
  connection: any,
  tableName: string
): Promise<{ success: boolean; schema?: any[]; row_count?: number; preview?: any[]; metadata?: { temporal_columns?: string[]; pk_candidates?: string[] }; error?: string }> {
  const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
  const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

const pythonScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import get_database_schema

result = get_database_schema(
    db_type='${dbType}',
    connection_config={
        'host': '${connection.host}',
        'port': ${connection.port},
        'database': '${connection.database}',
        'username': '${connection.username}',
        'password': '''${connection.password}'''
    },
    table_name='${tableName}'
)

import datetime, decimal, uuid
def convert_default(obj):
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        try:
            return float(obj)
        except Exception:
            return str(obj)
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode('utf-8')
        except Exception:
            return obj.hex()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    return str(obj)

print(json.dumps(result, default=convert_default, ensure_ascii=False))
`

  return executePythonScript(pythonPath, pythonScript)
}

// Helper function to preview database table
async function previewDatabaseTable(
  dbType: string,
  connection: any,
  tableName: string,
  limit: number
): Promise<{ success: boolean; schema?: any[]; rows?: any[]; total_rows?: number; row_count?: number; error?: string }> {
  const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
  const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

  const pythonScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import preview_database_table

result = preview_database_table(
    db_type='${dbType}',
    connection_config={
        'host': '${connection.host}',
        'port': ${connection.port},
        'database': '${connection.database}',
        'username': '${connection.username}',
        'password': '''${connection.password}'''
    },
    table_name='${tableName}',
    limit=${limit}
)

# Robust JSON serialization for common DB types
import datetime, decimal, uuid
def convert_default(obj):
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        try:
            return float(obj)
        except Exception:
            return str(obj)
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode('utf-8')
        except Exception:
            return obj.hex()
    if isinstance(obj, uuid.UUID):
        return str(obj)
    # Fallback: stringify any other non-serializable types
    return str(obj)

print(json.dumps(result, default=convert_default, ensure_ascii=False))
`

  return executePythonScript(pythonPath, pythonScript)
}

// Common function to execute Python scripts
function executePythonScript(pythonPath: string, script: string): Promise<any> {
  return new Promise((resolve) => {
    const python = spawn(pythonPath, ['-c', script])
    let output = ''
    let errorOutput = ''

    python.stdout.on('data', (data) => {
      output += data.toString()
    })

    python.stderr.on('data', (data) => {
      errorOutput += data.toString()
    })

    python.on('close', (code) => {
      if (code !== 0) {
        resolve({
          success: false,
          error: errorOutput || 'Python script failed'
        })
        return
      }

      try {
        // Extract JSON from output (get the last valid JSON object)
        const jsonMatches = output.match(/\{[\s\S]*\}/g)
        if (jsonMatches && jsonMatches.length > 0) {
          const result = JSON.parse(jsonMatches[jsonMatches.length - 1])
          resolve(result)
        } else {
          resolve({
            success: false,
            error: 'No valid JSON response from Python script'
          })
        }
      } catch (error: any) {
        resolve({
          success: false,
          error: `Failed to parse response: ${error.message}`
        })
      }
    })
  })
}
