import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/ai/config/bronze
 * Get AI-powered configuration suggestions for Bronze layer
 *
 * Request body (Option 1 - Database Source):
 * {
 *   "dbType": "postgresql" | "sql-server" | "mysql",
 *   "connection": { host, port, database, username, password },
 *   "tableName": "table_name",
 *   "connectionId": "optional_saved_connection_id"
 * }
 *
 * Request body (Option 2 - File/Other Sources):
 * {
 *   "sourceType": "file" | "api" | "nosql" | "streaming",
 *   "tableName": "source_name",
 *   "schema": [{ name: "col1", type: "string" }, ...],
 *   "sampleData": [[val1, val2, ...], [val1, val2, ...], ...]
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "suggestions": {
 *     "incremental_load": {...},
 *     "partitioning": {...},
 *     "schema_evolution": {...}
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, tableName, connectionId, sourceType, schema, sampleData } = body

    // Determine if this is a database source or file/other source
    const isDatabaseSource = !!dbType
    const isFileOrOtherSource = !!sourceType

    console.log('[AI API] Request received:', {
      isDatabaseSource,
      isFileOrOtherSource,
      tableName,
      sourceType,
      connectionId: connectionId ? 'provided' : 'missing',
      schemaProvided: !!schema,
      sampleDataProvided: !!sampleData
    })

    // Validate required fields based on source type
    if (isDatabaseSource) {
      if (!dbType || !tableName) {
        console.error('[AI API] Validation failed - database source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Database type and table name are required' },
          { status: 400 }
        )
      }
    } else if (isFileOrOtherSource) {
      if (!sourceType || !tableName || !schema || !sampleData) {
        console.error('[AI API] Validation failed - file source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Source type, table name, schema, and sample data are required' },
          { status: 400 }
        )
      }
    } else {
      console.error('[AI API] Validation failed - no source type specified')
      return NextResponse.json(
        { success: false, message: 'Either database or file source information must be provided' },
        { status: 400 }
      )
    }

    let connectionConfig = connection

    // Only handle database connection logic if this is a database source
    if (isDatabaseSource) {
      // If connectionId provided, fetch connection details from database
      if (connectionId) {
        console.log('[AI API] Fetching connection details for ID:', connectionId)
        const { getDatabase } = require('@/lib/db')
        const db = getDatabase()

        const savedConnection = db.prepare(`
          SELECT host, port, database, username, password
          FROM database_connections
          WHERE id = ?
        `).get(connectionId) as any

        if (!savedConnection) {
          console.error('[AI API] Connection not found:', connectionId)
          return NextResponse.json(
            { success: false, message: 'Connection not found' },
            { status: 404 }
          )
        }

        console.log('[AI API] Connection loaded:', { host: savedConnection.host, database: savedConnection.database })
        connectionConfig = savedConnection
      }

      // Validate connection details
      if (!connectionConfig || !connectionConfig.host || !connectionConfig.database) {
        console.error('[AI API] Invalid connection config:', connectionConfig ? 'incomplete' : 'missing')
        return NextResponse.json(
          { success: false, message: 'Missing connection details' },
          { status: 400 }
        )
      }
    }

    // Call Python AI Config Assistant
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    console.log('[AI API] Python path:', pythonPath)
    console.log('[AI API] Prefect flows path:', prefectFlowsPath)

    let pythonScript = ''

    if (isDatabaseSource) {
      // Generate script for database source
      pythonScript = `
import sys
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Debug: Print which AI provider will be used
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
openai_key = os.getenv("OPENAI_API_KEY")
print(f"[DEBUG] ANTHROPIC_API_KEY: {'SET' if anthropic_key else 'NOT SET'}", file=sys.stderr)
print(f"[DEBUG] OPENAI_API_KEY: {'SET' if openai_key else 'NOT SET'}", file=sys.stderr)

sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')

from tasks.database_bronze import get_sample_data
from utils.ai_config_assistant import get_bronze_suggestions

# Get sample data (1000 rows)
sample_result = get_sample_data(
    db_type='${dbType}',
    connection_config={
        'host': '${connectionConfig.host}',
        'port': ${connectionConfig.port || (dbType === 'sql-server' ? 1433 : dbType === 'postgresql' ? 5432 : 3306)},
        'database': '${connectionConfig.database}',
        'username': '${connectionConfig.username}',
        'password': '''${connectionConfig.password || ''}'''
    },
    table_name='${tableName}',
    sample_size=1000
)

if not sample_result['success']:
    print(json.dumps({
        'success': False,
        'message': sample_result.get('message', 'Failed to fetch sample data')
    }))
    sys.exit(0)

# Get AI suggestions
df = sample_result['dataframe']
suggestions = get_bronze_suggestions(
    df=df,
    table_name='${tableName}',
    source_type='database'
)

print(json.dumps({
    'success': True,
    'suggestions': suggestions
}))
`
    } else {
      // Generate script for file/other source
      const schemaJson = JSON.stringify(schema)
      const sampleDataJson = JSON.stringify(sampleData)

      pythonScript = `
import sys
import json
import os
import pandas as pd
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Debug: Print which AI provider will be used
anthropic_key = os.getenv("ANTHROPIC_API_KEY")
openai_key = os.getenv("OPENAI_API_KEY")
print(f"[DEBUG] ANTHROPIC_API_KEY: {'SET' if anthropic_key else 'NOT SET'}", file=sys.stderr)
print(f"[DEBUG] OPENAI_API_KEY: {'SET' if openai_key else 'NOT SET'}", file=sys.stderr)

sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')

from utils.ai_config_assistant import get_bronze_suggestions

# Create DataFrame from provided schema and sample data
schema = ${schemaJson}
sample_data = ${sampleDataJson}

# Build column mapping from schema
columns = [col['name'] for col in schema]

# Create DataFrame
df = pd.DataFrame(sample_data, columns=columns)

print(f"[DEBUG] Created DataFrame with {len(df)} rows and {len(df.columns)} columns", file=sys.stderr)
print(f"[DEBUG] Columns: {list(df.columns)}", file=sys.stderr)

# Get AI suggestions
suggestions = get_bronze_suggestions(
    df=df,
    table_name='${tableName}',
    source_type='${sourceType}'
)

print(json.dumps({
    'success': True,
    'suggestions': suggestions
}))
`
    }

    return new Promise<NextResponse>((resolve) => {
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
        console.log('[AI API] Python process closed with code:', code)
        console.log('[AI API] Python stdout:', output)
        console.log('[AI API] Python stderr:', errorOutput)

        if (code !== 0) {
          console.error('[AI API] Python error - non-zero exit code:', code)
          console.error('[AI API] Error output:', errorOutput)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to generate AI suggestions',
            error: errorOutput
          }, { status: 500 }))
          return
        }

        try {
          // Extract JSON from output (last valid JSON object)
          const jsonMatch = output.match(/\{[^{}]*"success"[^]*\}/g)
          if (jsonMatch && jsonMatch.length > 0) {
            const result = JSON.parse(jsonMatch[jsonMatch.length - 1])
            console.log('[AI API] Parsed result:', result)
            resolve(NextResponse.json(result))
          } else {
            console.error('[AI API] No valid JSON found in output')
            resolve(NextResponse.json({
              success: false,
              message: 'Invalid response from AI assistant',
              rawOutput: output
            }, { status: 500 }))
          }
        } catch (error) {
          console.error('[AI API] Parse error:', error)
          console.error('[AI API] Output:', output)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to parse AI response',
            error: error instanceof Error ? error.message : 'Unknown error'
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
