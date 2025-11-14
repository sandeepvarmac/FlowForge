import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { DatabaseConnection, UpdateConnectionInput } from '@/types/database-connection'

// GET /api/database-connections/[connectionId] - Get single connection
export async function GET(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const db = getDatabase()

    const connection = db.prepare(`
      SELECT
        id, name, description, type,
        host, port, database, username, password,
        ssl_enabled as sslEnabled,
        connection_timeout as connectionTimeout,
        last_tested_at as lastTestedAt,
        last_test_status as lastTestStatus,
        last_test_message as lastTestMessage,
        created_at as createdAt,
        updated_at as updatedAt
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as DatabaseConnection | undefined

    if (!connection) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, connection })
  } catch (error) {
    console.error('Failed to fetch connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch connection' },
      { status: 500 }
    )
  }
}

// PUT /api/database-connections/[connectionId] - Update connection
export async function PUT(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const body: UpdateConnectionInput = await request.json()
    const db = getDatabase()

    // Check if connection exists and get current password
    const existing = db.prepare('SELECT id, password, type, host, port, database, username FROM database_connections WHERE id = ?').get(params.connectionId) as any
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    // Test connection with updated credentials
    const testResult = await testConnection(
      body.type || existing.type,
      {
        host: body.host || existing.host,
        port: body.port || existing.port,
        database: body.database || existing.database,
        username: body.username || existing.username,
        password: body.password || existing.password
      }
    )

    const now = Date.now()
    const updates: string[] = []
    const values: any[] = []

    // Build dynamic update query
    if (body.name !== undefined) {
      updates.push('name = ?')
      values.push(body.name)
    }
    if (body.description !== undefined) {
      updates.push('description = ?')
      values.push(body.description)
    }
    if (body.type !== undefined) {
      updates.push('type = ?')
      values.push(body.type)
    }
    if (body.host !== undefined) {
      updates.push('host = ?')
      values.push(body.host)
    }
    if (body.port !== undefined) {
      updates.push('port = ?')
      values.push(body.port)
    }
    if (body.database !== undefined) {
      updates.push('database = ?')
      values.push(body.database)
    }
    if (body.username !== undefined) {
      updates.push('username = ?')
      values.push(body.username)
    }
    if (body.password !== undefined) {
      updates.push('password = ?')
      values.push(body.password)
    }
    if (body.sslEnabled !== undefined) {
      updates.push('ssl_enabled = ?')
      values.push(body.sslEnabled ? 1 : 0)
    }
    if (body.connectionTimeout !== undefined) {
      updates.push('connection_timeout = ?')
      values.push(body.connectionTimeout)
    }

    // Update test results
    updates.push('last_tested_at = ?')
    values.push(now)
    updates.push('last_test_status = ?')
    values.push(testResult.success ? 'success' : 'failed')
    updates.push('last_test_message = ?')
    values.push(testResult.message)

    updates.push('updated_at = ?')
    values.push(now)

    values.push(params.connectionId)

    const stmt = db.prepare(`
      UPDATE database_connections
      SET ${updates.join(', ')}
      WHERE id = ?
    `)

    stmt.run(...values)

    // Fetch updated connection
    const connection = db.prepare(`
      SELECT
        id, name, description, type,
        host, port, database, username,
        ssl_enabled as sslEnabled,
        connection_timeout as connectionTimeout,
        last_tested_at as lastTestedAt,
        last_test_status as lastTestStatus,
        last_test_message as lastTestMessage,
        created_at as createdAt,
        updated_at as updatedAt
      FROM database_connections
      WHERE id = ?
    `).get(params.connectionId) as Omit<DatabaseConnection, 'password'>

    // Return success based on test result
    // Note: Connection is ALWAYS saved, but success reflects test status
    // This allows modal to stay open on failure while preserving changes
    return NextResponse.json({
      success: testResult.success,
      connection,
      testResult,
      message: testResult.success ? undefined : testResult.message
    }, { status: testResult.success ? 200 : 400 })
  } catch (error: any) {
    console.error('Failed to update connection:', error)

    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { success: false, message: 'A connection with this name already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Failed to update connection' },
      { status: 500 }
    )
  }
}

// Helper function to test database connection
async function testConnection(dbType: string, connection: any): Promise<{ success: boolean; message: string }> {
  const { spawn } = require('child_process')
  const path = require('path')

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

    python.stdout.on('data', (data: Buffer) => {
      output += data.toString()
    })

    python.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString()
    })

    python.on('close', (code: number) => {
      if (code !== 0) {
        resolve({
          success: false,
          message: errorOutput || 'Connection test failed'
        })
        return
      }

      try {
        const jsonMatch = output.match(/\{[^{}]*"success"[^}]*\}/g)
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
          message: 'Failed to parse connection test response'
        })
      }
    })
  })
}

// DELETE /api/database-connections/[connectionId] - Delete connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: { connectionId: string } }
) {
  try {
    const db = getDatabase()

    // Check if connection exists
    const existing = db.prepare('SELECT id, name FROM database_connections WHERE id = ?').get(params.connectionId) as { id: string; name: string } | undefined
    if (!existing) {
      return NextResponse.json(
        { success: false, message: 'Connection not found' },
        { status: 404 }
      )
    }

    // TODO: Check if connection is used by any jobs before deleting
    // This would require adding a connection_id column to jobs table

    const stmt = db.prepare('DELETE FROM database_connections WHERE id = ?')
    stmt.run(params.connectionId)

    console.log(`✅ Deleted connection: ${existing.name}`)

    return NextResponse.json({ success: true, message: 'Connection deleted successfully' })
  } catch (error) {
    console.error('Failed to delete connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to delete connection' },
      { status: 500 }
    )
  }
}
