import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, connectionId } = body

    // Validate required fields
    if (!dbType) {
      return NextResponse.json(
        { success: false, message: 'Database type is required' },
        { status: 400 }
      )
    }

    let connectionConfig = connection

    // If connectionId is provided, fetch full connection details (including password)
    if (connectionId) {
      const { getDatabase } = require('@/lib/db')
      const db = getDatabase()

      const savedConnection = db.prepare(`
        SELECT host, port, database, username, password
        FROM database_connections
        WHERE id = ?
      `).get(connectionId) as any

      if (!savedConnection) {
        return NextResponse.json(
          { success: false, message: 'Connection not found' },
          { status: 404 }
        )
      }

      connectionConfig = savedConnection
    }

    // Validate we have connection details
    if (!connectionConfig || !connectionConfig.host || !connectionConfig.database) {
      return NextResponse.json(
        { success: false, message: 'Missing connection details' },
        { status: 400 }
      )
    }

    // Call Python Prefect task to list tables
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    const testScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import list_database_tables

result = list_database_tables(
    db_type='${dbType}',
    connection_config={
        'host': '${connectionConfig.host}',
        'port': ${connectionConfig.port || (dbType === 'sql-server' ? 1433 : dbType === 'postgresql' ? 5432 : 3306)},
        'database': '${connectionConfig.database}',
        'username': '${connectionConfig.username}',
        'password': '''${connectionConfig.password || ''}'''
    }
)
print(json.dumps(result))
`

    return new Promise<NextResponse>((resolve) => {
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
          console.error('Python error:', errorOutput)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to list tables',
            error: errorOutput
          }, { status: 500 }))
          return
        }

        try {
          // Extract JSON from output
          const jsonMatch = output.match(/\{[^{}]*"success"[^{}]*\}/g)
          if (jsonMatch && jsonMatch.length > 0) {
            const result = JSON.parse(jsonMatch[jsonMatch.length - 1])
            resolve(NextResponse.json(result))
          } else {
            resolve(NextResponse.json({
              success: false,
              message: 'Invalid response from database'
            }, { status: 500 }))
          }
        } catch (error) {
          console.error('Parse error:', error)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to parse response'
          }, { status: 500 }))
        }
      })
    })
  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
