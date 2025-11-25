import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

/**
 * POST /api/ai/config/full
 * Get unified AI-powered configuration suggestions for Bronze, Silver, and Gold layers
 *
 * Request body (Option 1 - Database Source):
 * {
 *   "dbType": "postgresql" | "sql-server" | "mysql",
 *   "connection": { host, port, database, username, password },
 *   "tableName": "table_name",
 *   "connectionId": "optional_saved_connection_id",
 *   "businessContext": "optional_business_context"
 * }
 *
 * Request body (Option 2 - File/Other Sources):
 * {
 *   "sourceType": "file" | "api" | "nosql" | "streaming",
 *   "tableName": "source_name",
 *   "schema": [{ name: "col1", type: "string" }, ...],
 *   "sampleData": [[val1, val2, ...], [val1, val2, ...], ...],
 *   "businessContext": "optional_business_context"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "bronze": { incremental_load, partitioning, schema_evolution },
 *   "silver": { primary_key, deduplication, merge_strategy, quality_rules },
 *   "gold": { aggregations, business_keys, semantic_naming, metrics },
 *   "analysisSummary": { status, progress, events },
 *   "providerUsed": "anthropic" | "openai"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { dbType, connection, tableName, connectionId, sourceType, schema, sampleData, businessContext } = body

    // Determine if this is a database source or file/other source
    const isDatabaseSource = !!dbType
    const isFileOrOtherSource = !!sourceType

    console.log('[AI Full API] Request received:', {
      isDatabaseSource,
      isFileOrOtherSource,
      tableName,
      sourceType,
      connectionId: connectionId ? 'provided' : 'missing',
      schemaProvided: !!schema,
      sampleDataProvided: !!sampleData,
      businessContextProvided: !!businessContext
    })

    // Validate required fields based on source type
    if (isDatabaseSource) {
      if (!dbType || !tableName) {
        console.error('[AI Full API] Validation failed - database source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Database type and table name are required' },
          { status: 400 }
        )
      }
    } else if (isFileOrOtherSource) {
      if (!sourceType || !tableName || !schema || !sampleData) {
        console.error('[AI Full API] Validation failed - file source missing required fields')
        return NextResponse.json(
          { success: false, message: 'Source type, table name, schema, and sample data are required' },
          { status: 400 }
        )
      }
    } else {
      console.error('[AI Full API] Validation failed - no source type specified')
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
        console.log('[AI Full API] Fetching connection details for ID:', connectionId)
        const { getDatabase } = require('@/lib/db')
        const db = getDatabase()

        const savedConnection = db.prepare(`
          SELECT host, port, database, username, password
          FROM database_connections
          WHERE id = ?
        `).get(connectionId) as any

        if (!savedConnection) {
          console.error('[AI Full API] Connection not found:', connectionId)
          return NextResponse.json(
            { success: false, message: 'Connection not found' },
            { status: 404 }
          )
        }

        console.log('[AI Full API] Connection loaded:', { host: savedConnection.host, database: savedConnection.database })
        connectionConfig = savedConnection
      }

      // Validate connection details
      if (!connectionConfig || !connectionConfig.host || !connectionConfig.database) {
        console.error('[AI Full API] Invalid connection config:', connectionConfig ? 'incomplete' : 'missing')
        return NextResponse.json(
          { success: false, message: 'Missing connection details' },
          { status: 400 }
        )
      }
    }

    // Call Python AI Config Assistant
    const prefectFlowsPath = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const pythonPath = path.join(prefectFlowsPath, '.venv', 'Scripts', 'python.exe')

    console.log('[AI Full API] Python path:', pythonPath)
    console.log('[AI Full API] Prefect flows path:', prefectFlowsPath)

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

sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')

from tasks.database_bronze import get_sample_data
from utils.ai_config_assistant import analyze_full_pipeline

# Emit progress event
def emit_progress(stage, message):
    event = {
        'type': 'progress',
        'stage': stage,
        'message': message
    }
    print('PROGRESS:' + json.dumps(event), file=sys.stderr, flush=True)

emit_progress('sampling', 'Fetching sample data from database...')

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

emit_progress('profiling', 'Analyzing data structure and patterns...')

# Get unified AI suggestions
df = sample_result['dataframe']
business_context = ${businessContext ? `'''${businessContext}'''` : 'None'}

result = analyze_full_pipeline(
    df=df,
    table_name='${tableName}',
    source_type='database',
    business_context=business_context
)

print(json.dumps(result))
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

sys.path.insert(0, '${prefectFlowsPath.replace(/\\/g, '\\\\')}')

from utils.ai_config_assistant import analyze_full_pipeline

# Emit progress event
def emit_progress(stage, message):
    event = {
        'type': 'progress',
        'stage': stage,
        'message': message
    }
    print('PROGRESS:' + json.dumps(event), file=sys.stderr, flush=True)

emit_progress('loading', 'Loading and preparing data...')

# Create DataFrame from provided schema and sample data
schema = ${schemaJson}
sample_data = ${sampleDataJson}

# Build column mapping from schema
columns = [col['name'] for col in schema]

# Create DataFrame
df = pd.DataFrame(sample_data, columns=columns)

print(f"[DEBUG] Created DataFrame with {len(df)} rows and {len(df.columns)} columns", file=sys.stderr)

emit_progress('profiling', 'Analyzing data structure and patterns...')

# Get unified AI suggestions
business_context = ${businessContext ? `'''${businessContext}'''` : 'None'}

result = analyze_full_pipeline(
    df=df,
    table_name='${tableName}',
    source_type='${sourceType}',
    business_context=business_context
)

print(json.dumps(result))
`
    }

    return new Promise<NextResponse>((resolve) => {
      const python = spawn(pythonPath, ['-c', pythonScript])
      let output = ''
      let errorOutput = ''
      const progressEvents: any[] = []

      python.stdout.on('data', (data) => {
        output += data.toString()
      })

      python.stderr.on('data', (data) => {
        const text = data.toString()
        errorOutput += text

        // Extract progress events
        const progressMatches = text.match(/PROGRESS:(\{.*?\})/g)
        if (progressMatches) {
          progressMatches.forEach(match => {
            try {
              const eventJson = match.replace('PROGRESS:', '')
              const event = JSON.parse(eventJson)
              progressEvents.push(event)
              console.log('[AI Full API] Progress:', event.stage, '-', event.message)
            } catch (e) {
              // Ignore parse errors for progress events
            }
          })
        }
      })

      python.on('close', (code) => {
        console.log('[AI Full API] Python process closed with code:', code)
        console.log('[AI Full API] Python stdout:', output)
        console.log('[AI Full API] Python stderr (last 500 chars):', errorOutput.slice(-500))

        if (code !== 0) {
          console.error('[AI Full API] Python error - non-zero exit code:', code)
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

            // Add progress events to result
            result.progressEvents = progressEvents

            console.log('[AI Full API] Parsed result with provider:', result.providerUsed || 'unknown')
            resolve(NextResponse.json(result))
          } else {
            console.error('[AI Full API] No valid JSON found in output')
            resolve(NextResponse.json({
              success: false,
              message: 'Invalid response from AI assistant',
              rawOutput: output.slice(-500)
            }, { status: 500 }))
          }
        } catch (error) {
          console.error('[AI Full API] Parse error:', error)
          resolve(NextResponse.json({
            success: false,
            message: 'Failed to parse AI response',
            error: error instanceof Error ? error.message : 'Unknown error'
          }, { status: 500 }))
        }
      })
    })
  } catch (error) {
    console.error('[AI Full API] Unexpected error:', error)
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}
