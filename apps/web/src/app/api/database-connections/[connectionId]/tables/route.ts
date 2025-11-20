import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { spawn } from 'child_process'
import path from 'path'

/**
 * GET /api/database-connections/[connectionId]/tables
 * List all tables in the connected database
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
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

    // Call Python function to list tables
    const host =
      connection.host === 'localhost' || connection.host === '::1'
        ? '127.0.0.1'
        : connection.host

    const result = await listDatabaseTables(connection.type, {
      host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password
    })

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to list tables' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tables: result.tables,
      count: result.count,
      connection: {
        id: connection.id,
        name: connection.name,
        type: connection.type,
        database: connection.database
      }
    })

  } catch (error: any) {
    console.error('Failed to list tables:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// Helper function to call Python script
async function listDatabaseTables(
  dbType: string,
  connection: any
): Promise<{ success: boolean; tables?: string[]; count?: number; error?: string }> {
  const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
  const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

  const pythonScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import list_database_tables

result = list_database_tables(
    db_type='${dbType}',
    connection_config={
        'host': '${connection.host}',
        'port': ${connection.port},
        'database': '${connection.database}',
        'username': '${connection.username}',
        'password': '''${connection.password}'''
    }
)
print(json.dumps(result))
`

  return new Promise((resolve) => {
    const python = spawn(pythonPath, ['-c', pythonScript])
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
          error: errorOutput || 'Failed to list tables'
        })
        return
      }

      try {
        // Extract JSON from output
        const jsonMatch = output.match(/\{[^{}]*"success"[^}]*\}/g)
        if (jsonMatch && jsonMatch.length > 0) {
          const result = JSON.parse(jsonMatch[jsonMatch.length - 1])
          resolve(result)
        } else {
          resolve({
            success: false,
            error: 'Invalid response from Python script'
          })
        }
      } catch (error) {
        resolve({
          success: false,
          error: 'Failed to parse Python response'
        })
      }
    })
  })
}
