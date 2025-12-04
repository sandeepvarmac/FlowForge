import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/database-connections/test
 * Test database connection credentials without saving
 * This endpoint is used by the modal's "Test Connection" button
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, host, port, database, username, password } = body

    // Validate required fields
    if (!type || !host || !port || !database || !username || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing required connection parameters' },
        { status: 400 }
      )
    }

    // Test connection without saving
    const testResult = await testConnection(type, {
      host,
      port,
      database,
      username,
      password
    })

    return NextResponse.json(testResult)
  } catch (error) {
    console.error('Failed to test connection:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to test connection' },
      { status: 500 }
    )
  }
}

async function testConnection(
  dbType: string,
  connection: { host: string; port: number; database: string; username: string; password: string }
): Promise<{ success: boolean; message: string; version?: string }> {
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

    // Timeout after 30 seconds
    setTimeout(() => {
      python.kill()
      resolve({
        success: false,
        message: 'Connection test timed out after 30 seconds'
      })
    }, 30000)
  })
}
