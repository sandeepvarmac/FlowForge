import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/ai/config/silver
 * Get AI-powered configuration suggestions for Silver layer
 *
 * Request body (Option 1 - Database Source):
 * {
 *   "dbType": "postgresql" | "sql-server" | "mysql",
 *   "connection": { host, port, database, username, password },
 *   "tableName": "table_name",
 *   "connectionId": "optional_saved_connection_id",
 *   "bronzeMetadata": { ... } // Optional metadata from Bronze layer
 * }
 *
 * Request body (Option 2 - File/Other Sources):
 * {
 *   "sourceType": "file" | "api" | "nosql" | "streaming",
 *   "tableName": "source_name",
 *   "schema": [{ name: "col1", type: "string" }, ...],
 *   "sampleData": [[val1, val2, ...], [val1, val2, ...], ...],
 *   "bronzeMetadata": { ... } // Optional metadata from Bronze layer
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "suggestions": {
 *     "primary_key": {...},
 *     "deduplication": {...},
 *     "merge_strategy": {...},
 *     "quality_rules": {...}
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, tableName, connectionId, bronzeMetadata, sourceType, schema, sampleData } = body

    // Determine if this is a database source or file/other source
    const isDatabaseSource = !!dbType
    const isFileOrOtherSource = !!sourceType

    console.log('[Silver AI API] Request received:', {
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
        console.error('[Silver AI API] Validation failed - database source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Database type and table name are required' },
          { status: 400 }
        )
      }
    } else if (isFileOrOtherSource) {
      if (!sourceType || !tableName || !schema || !sampleData) {
        console.error('[Silver AI API] Validation failed - file source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Source type, table name, schema, and sample data are required' },
          { status: 400 }
        )
      }
    } else {
      console.error('[Silver AI API] Validation failed - no source type specified')
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
        console.log('[Silver AI API] Fetching connection details for ID:', connectionId)
        const { getDatabase } = require('@/lib/db')
        const db = getDatabase()

        const savedConnection = db.prepare(`
          SELECT host, port, database, username, password
          FROM database_connections
          WHERE id = ?
        `).get(connectionId) as any

        if (!savedConnection) {
          console.error('[Silver AI API] Connection not found:', connectionId)
          return NextResponse.json(
            { success: false, message: 'Connection not found' },
            { status: 404 }
          )
        }

        console.log('[Silver AI API] Connection loaded:', { host: savedConnection.host, database: savedConnection.database })
        connectionConfig = savedConnection
      }

      // Validate connection details
      if (!connectionConfig || !connectionConfig.host || !connectionConfig.database) {
        console.error('[Silver AI API] Invalid connection config:', connectionConfig ? 'incomplete' : 'missing')
        return NextResponse.json(
          { success: false, message: 'Missing connection details' },
          { status: 400 }
        )
      }
    }

    // Call Python AI Config Assistant for Silver layer
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    console.log('[Silver AI API] Python path:', pythonPath)
    console.log('[Silver AI API] Prefect flows path:', prefectFlowsPath)

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
from utils.ai_config_assistant import get_silver_suggestions

# Get sample data (1000 rows)
sample_result = get_sample_data(
    db_type='${dbType}',
    connection_config={
        'host': '${connectionConfig.host}',
        'port': ${connectionConfig.port},
        'database': '${connectionConfig.database}',
        'username': '${connectionConfig.username}',
        'password': '''${connectionConfig.password}'''
    },
    table_name='${tableName}',
    limit=1000
)

if not sample_result['success']:
    print(json.dumps({
        'success': False,
        'error': sample_result.get('error', 'Failed to fetch sample data')
    }))
    sys.exit(0)

# Get AI suggestions for Silver layer
df = sample_result['dataframe']
bronze_metadata = ${bronzeMetadata ? JSON.stringify(bronzeMetadata) : 'None'}

suggestions = get_silver_suggestions(
    df=df,
    table_name='${tableName}',
    bronze_metadata=bronze_metadata
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

from utils.ai_config_assistant import get_silver_suggestions

# Create DataFrame from provided schema and sample data
schema = ${schemaJson}
sample_data = ${sampleDataJson}

# Build column mapping from schema
columns = [col['name'] for col in schema]

# Create DataFrame
df = pd.DataFrame(sample_data, columns=columns)

print(f"[DEBUG] Created DataFrame with {len(df)} rows and {len(df.columns)} columns", file=sys.stderr)
print(f"[DEBUG] Columns: {list(df.columns)}", file=sys.stderr)

# Get AI suggestions for Silver layer
bronze_metadata = ${bronzeMetadata ? JSON.stringify(bronzeMetadata) : 'None'}

suggestions = get_silver_suggestions(
    df=df,
    table_name='${tableName}',
    bronze_metadata=bronze_metadata
)

print(json.dumps({
    'success': True,
    'suggestions': suggestions
}))
`
    }

    console.log('[Silver AI API] Executing Python script...')

    const result = await executePythonScript(pythonPath, pythonScript)

    console.log('[Silver AI API] Python execution result:', result.success ? 'SUCCESS' : 'FAILED')
    if (!result.success) {
      console.error('[Silver AI API] Error:', result.error)
    }

    if (result.success && result.suggestions) {
      console.log('[Silver AI API] Suggestions received:', Object.keys(result.suggestions))
      return NextResponse.json({
        success: true,
        suggestions: result.suggestions
      })
    } else {
      return NextResponse.json(
        {
          success: false,
          message: result.error || 'Failed to generate Silver layer suggestions'
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('[Silver AI API] Exception:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

// Helper function to execute Python scripts
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
      console.log('[Silver AI API] Python stderr:', data.toString())
    })

    python.on('close', (code) => {
      console.log('[Silver AI API] Python process closed with code:', code)

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
        console.error('[Silver AI API] JSON parse error:', error.message)
        console.error('[Silver AI API] Raw output:', output)
        resolve({
          success: false,
          error: `Failed to parse response: ${error.message}`
        })
      }
    })
  })
}
