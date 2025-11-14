import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, tableName, connectionId } = body

    console.log('[Schema API] Request received:', { dbType, tableName, connectionId: connectionId ? 'provided' : 'missing' })

    // Validate required fields
    if (!dbType || !tableName) {
      console.error('[Schema API] Validation failed - missing required fields')
      return NextResponse.json(
        { success: false, message: 'Database type and table name are required' },
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

    // Call Python Prefect task to get schema
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    const testScript = `
import sys
import json
import datetime
import decimal
import uuid
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import get_database_schema

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

result = get_database_schema(
    db_type='${dbType}',
    connection_config={
        'host': '${connectionConfig.host}',
        'port': ${connectionConfig.port || (dbType === 'sql-server' ? 1433 : dbType === 'postgresql' ? 5432 : 3306)},
        'database': '${connectionConfig.database}',
        'username': '${connectionConfig.username}',
        'password': '''${connectionConfig.password || ''}'''
    },
    table_name='${tableName}'
)

print(json.dumps(result, default=convert_default, ensure_ascii=False))
`

    return new Promise<NextResponse>((resolve) => {
      console.log('[Schema API] Generated Python script:')
      console.log('='.repeat(80))
      console.log(testScript)
      console.log('='.repeat(80))

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
        console.log('[Schema API] Python process closed with code:', code)
        console.log('[Schema API] Python stdout:', output)
        console.log('[Schema API] Python stderr:', errorOutput)

        if (code !== 0) {
          console.error('[Schema API] Python error - non-zero exit code:', code)
          console.error('[Schema API] Error output:', errorOutput)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to get schema',
            error: errorOutput
          }, { status: 500 }))
          return
        }

        try {
          console.log('[Schema API] Raw output length:', output.length)
          console.log('[Schema API] Attempting to parse JSON from output...')

          // Extract the last JSON object from stdout, allowing nested braces
          const jsonMatches = output.match(/\{[\s\S]*\}/g)
          console.log('[Schema API] JSON matches found:', jsonMatches ? jsonMatches.length : 0)

          if (jsonMatches && jsonMatches.length > 0) {
            const lastMatch = jsonMatches[jsonMatches.length - 1]
            console.log('[Schema API] Last match length:', lastMatch.length)
            console.log('[Schema API] Last match first 200 chars:', lastMatch.substring(0, 200))

            const result = JSON.parse(lastMatch)
            console.log('[Schema API] Successfully parsed JSON, success:', result.success)
            console.log('[Schema API] Schema columns count:', result.schema ? result.schema.length : 0)

            resolve(NextResponse.json(result))
          } else {
            console.error('[Schema API] No JSON matches found in output')
            resolve(NextResponse.json({ success: false, message: 'Invalid response from database' }, { status: 500 }))
          }
        } catch (error) {
          console.error('[Schema API] Parse error:', error)
          console.error('[Schema API] Error details:', error instanceof Error ? error.message : 'Unknown error')
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


