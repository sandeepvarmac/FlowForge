import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, tableName } = body

    // Validate required fields
    if (!dbType || !connection || !tableName) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Call Python Prefect task to get schema
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    const testScript = `
import sys
import json
sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')
from tasks.database_bronze import get_database_schema

result = get_database_schema(
    db_type='${dbType}',
    connection_config={
        'host': '${connection.host}',
        'port': ${connection.port || (dbType === 'sql-server' ? 1433 : dbType === 'postgresql' ? 5432 : 3306)},
        'database': '${connection.database}',
        'username': '${connection.username}',
        'password': '''${connection.password}'''
    },
    table_name='${tableName}'
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
            message: 'Failed to get schema',
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
