import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { DatabaseConnection, CreateConnectionInput } from '@/types/database-connection'
import { spawn } from 'child_process'
import path from 'path'

// GET /api/database-connections - List all connections
export async function GET() {
  try {
    const db = getDatabase()

    const connections = db.prepare(`
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
      ORDER BY name ASC
    `).all() as Array<Omit<DatabaseConnection, 'password'>>

    // Don't return passwords in list
    return NextResponse.json({ success: true, connections })
  } catch (error) {
    console.error('Failed to fetch connections:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to fetch connections' },
      { status: 500 }
    )
  }
}

// POST /api/database-connections - Create new connection
export async function POST(request: NextRequest) {
  try {
    const body: CreateConnectionInput = await request.json()

    // Validate required fields
    if (!body.name || !body.type || !body.host || !body.database || !body.username || !body.password) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Test connection before saving
    const testResult = await testConnection(body.type, {
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      password: body.password
    })

    const db = getDatabase()
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = Date.now()

    const stmt = db.prepare(`
      INSERT INTO database_connections (
        id, name, description, type,
        host, port, database, username, password,
        ssl_enabled, connection_timeout,
        last_tested_at, last_test_status, last_test_message,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id,
      body.name,
      body.description || null,
      body.type,
      body.host,
      body.port,
      body.database,
      body.username,
      body.password, // In production, encrypt this
      body.sslEnabled ? 1 : 0,
      body.connectionTimeout || 30,
      now,
      testResult.success ? 'success' : 'failed',
      testResult.message,
      now,
      now
    )

    // Return connection without password
    const connection = {
      id,
      name: body.name,
      description: body.description,
      type: body.type,
      host: body.host,
      port: body.port,
      database: body.database,
      username: body.username,
      sslEnabled: body.sslEnabled,
      connectionTimeout: body.connectionTimeout || 30,
      lastTestedAt: now,
      lastTestStatus: testResult.success ? 'success' as const : 'failed' as const,
      lastTestMessage: testResult.message,
      createdAt: now,
      updatedAt: now
    }

    return NextResponse.json({ success: true, connection, testResult })
  } catch (error: any) {
    console.error('Failed to create connection:', error)

    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json(
        { success: false, message: 'A connection with this name already exists' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: error.message || 'Failed to create connection' },
      { status: 500 }
    )
  }
}

// Helper function to test database connection
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
