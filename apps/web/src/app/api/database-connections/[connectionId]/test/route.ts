import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { spawn } from 'child_process'
import path from 'path'

// POST /api/database-connections/[connectionId]/test - Test existing connection
export async function POST(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const db = getDatabase()

    // Fetch connection
    const connection = db.prepare(`
      SELECT id, type, host, port, database, username, password
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as any

    if (!connection) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    // Test connection
    const testResult = await testConnection(connection.type, {
      host: connection.host,
      port: connection.port,
      database: connection.database,
      username: connection.username,
      password: connection.password
    })

    // Update last test results
    const now = Date.now()
    db.prepare(`
      UPDATE database_connections
      SET last_tested_at = ?,
          last_test_status = ?,
          last_test_message = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      now,
      testResult.success ? 'success' : 'failed',
      testResult.message,
      now,
      params.connectionId
    )

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('Failed to test connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to test connection' },
      { status: 500 }
    )
  }
}

async function testConnection(dbType: string, connection: any): Promise<{ success: boolean; message: string; version?: string }> {
  const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
  const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

  const testScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import test_database_connection

result = test_database_connection(
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
    const python = spawn(pythonPath, ['-c', testScript])
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
          message: errorOutput || 'Connection test failed'
        })
        return
      }

      try {
        const jsonMatch = output.match(/\{[^{}]*"success"[^{}]*\}/g)
        if (jsonMatch && jsonMatch.length > 0) {
          const result = JSON.parse(jsonMatch[jsonMatch.length - 1])
          resolve(result)
        } else {
          resolve({
            success: false,
            message: 'Invalid response from connection test'
          })
        }
      } catch (error) {
        resolve({
          success: false,
          message: 'Failed to parse connection test result'
        })
      }
    })
  })
}
