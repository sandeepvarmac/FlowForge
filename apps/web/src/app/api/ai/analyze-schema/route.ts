import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

export const runtime = 'nodejs'
export const maxDuration = 30

interface SchemaColumn {
  name: string
  type: string
  sample?: string
}

interface AnalyzeSchemaRequest {
  schema: SchemaColumn[]
  sampleData?: any[]
  fileName?: string
  rowCount?: number
}

interface ColumnClassification {
  name: string
  inferredType: string
  role: 'primary_key' | 'foreign_key' | 'dimension' | 'measure' | 'temporal' | 'attribute'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

interface SchemaIntelligenceResponse {
  primaryKeys: string[]
  foreignKeys: Array<{ column: string; referencesTable: string }>
  temporalColumns: string[]
  measureColumns: string[]
  dimensionColumns: string[]
  classifications: ColumnClassification[]
  suggestedTableName: string
  tableType: 'fact' | 'dimension' | 'transactional' | 'reference'
  summary: string
  dataQualityHints: string[]
}

/**
 * POST /api/ai/analyze-schema
 * AI-powered schema intelligence using Claude Haiku with OpenAI fallback
 */
export async function POST(request: NextRequest) {
  try {
    const body: AnalyzeSchemaRequest = await request.json()
    const { schema, sampleData, fileName, rowCount } = body

    if (!schema || schema.length === 0) {
      return NextResponse.json(
        { error: 'Schema is required' },
        { status: 400 }
      )
    }

    // Try Anthropic first (Claude Haiku for speed/cost)
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey && anthropicKey !== 'your_anthropic_api_key_here') {
      try {
        const result = await analyzeWithAnthropic(anthropicKey, schema, sampleData, fileName, rowCount)
        return NextResponse.json({ analysis: result, provider: 'anthropic' })
      } catch (error) {
        console.warn('[Schema Intelligence] Anthropic failed, trying OpenAI fallback:', error)
      }
    }

    // Fallback to OpenAI
    const openaiKey = process.env.OPENAI_API_KEY
    if (openaiKey && openaiKey !== 'your_openai_api_key_here') {
      try {
        const result = await analyzeWithOpenAI(openaiKey, schema, sampleData, fileName, rowCount)
        return NextResponse.json({ analysis: result, provider: 'openai' })
      } catch (error) {
        console.error('[Schema Intelligence] OpenAI fallback failed:', error)
      }
    }

    // No API keys configured - return mock response for demo
    console.log('[Schema Intelligence] No API keys configured, returning mock response')
    const mockResult = generateMockAnalysis(schema, sampleData, fileName)
    return NextResponse.json({ analysis: mockResult, provider: 'mock' })

  } catch (error) {
    console.error('[Schema Intelligence] Error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze schema' },
      { status: 500 }
    )
  }
}

async function analyzeWithAnthropic(
  apiKey: string,
  schema: SchemaColumn[],
  sampleData?: any[],
  fileName?: string,
  rowCount?: number
): Promise<SchemaIntelligenceResponse> {
  const client = new Anthropic({ apiKey })
  const prompt = buildPrompt(schema, sampleData, fileName, rowCount)

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const textContent = message.content.find(block => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Anthropic')
  }

  return parseAIResponse(textContent.text)
}

async function analyzeWithOpenAI(
  apiKey: string,
  schema: SchemaColumn[],
  sampleData?: any[],
  fileName?: string,
  rowCount?: number
): Promise<SchemaIntelligenceResponse> {
  const client = new OpenAI({ apiKey })
  const prompt = buildPrompt(schema, sampleData, fileName, rowCount)

  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  })

  const content = completion.choices[0]?.message?.content
  if (!content) {
    throw new Error('No response from OpenAI')
  }

  return parseAIResponse(content)
}

function buildPrompt(
  schema: SchemaColumn[],
  sampleData?: any[],
  fileName?: string,
  rowCount?: number
): string {
  const schemaStr = schema.map(col =>
    `- ${col.name} (${col.type})${col.sample ? `: sample="${col.sample}"` : ''}`
  ).join('\n')

  const sampleStr = sampleData && sampleData.length > 0
    ? `\n\n## Sample Data (first ${Math.min(sampleData.length, 5)} rows)\n${JSON.stringify(sampleData.slice(0, 5), null, 2)}`
    : ''

  return `You are a Senior Data Architect analyzing a dataset schema. Analyze the following schema and classify each column.

## File Information
${fileName ? `- File Name: ${fileName}` : ''}
${rowCount ? `- Row Count: ${rowCount}` : ''}

## Schema (${schema.length} columns)
${schemaStr}
${sampleStr}

## Your Task
Analyze this schema and provide:

1. **Primary Key(s)**: Identify columns that uniquely identify each row. Look for:
   - Columns named 'id', '[table]_id', or ending with '_id' that appear to be THIS table's identifier (not foreign keys)
   - Columns with unique sequential or UUID-like values
   - DO NOT include foreign keys (references to other tables)

2. **Foreign Keys**: Identify columns that reference other tables:
   - Columns like 'customer_id', 'user_id', 'product_id' that reference OTHER entities
   - Include what table they likely reference

3. **Temporal Columns**: Date/time columns useful for partitioning or incremental loads

4. **Measure Columns**: Numeric columns representing quantities, amounts, scores (for aggregation)

5. **Dimension Columns**: Categorical columns for grouping/filtering

6. **Table Type**: Is this a fact table (transactions/events), dimension table (reference data), or transactional table?

7. **Data Quality Hints**: Any potential issues or recommendations

Respond with ONLY a JSON object in this exact format:
\`\`\`json
{
  "primaryKeys": ["column_name"],
  "foreignKeys": [
    {"column": "customer_id", "referencesTable": "customers"}
  ],
  "temporalColumns": ["date_column"],
  "measureColumns": ["amount_column"],
  "dimensionColumns": ["category_column"],
  "classifications": [
    {
      "name": "column_name",
      "inferredType": "string|integer|decimal|date|boolean",
      "role": "primary_key|foreign_key|dimension|measure|temporal|attribute",
      "confidence": "high|medium|low",
      "reasoning": "Brief explanation"
    }
  ],
  "suggestedTableName": "suggested_name_for_table",
  "tableType": "fact|dimension|transactional|reference",
  "summary": "One sentence summary of what this data represents",
  "dataQualityHints": ["hint1", "hint2"]
}
\`\`\``
}

function parseAIResponse(text: string): SchemaIntelligenceResponse {
  // Try to extract JSON from markdown code block
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/)
  const jsonStr = jsonMatch ? jsonMatch[1] : text

  try {
    const parsed = JSON.parse(jsonStr.trim())
    return {
      primaryKeys: parsed.primaryKeys || [],
      foreignKeys: parsed.foreignKeys || [],
      temporalColumns: parsed.temporalColumns || [],
      measureColumns: parsed.measureColumns || [],
      dimensionColumns: parsed.dimensionColumns || [],
      classifications: parsed.classifications || [],
      suggestedTableName: parsed.suggestedTableName || 'unknown_table',
      tableType: parsed.tableType || 'transactional',
      summary: parsed.summary || 'Data table',
      dataQualityHints: parsed.dataQualityHints || []
    }
  } catch (error) {
    console.error('[Schema Intelligence] Failed to parse AI response:', error)
    throw new Error('Failed to parse AI response')
  }
}

/**
 * Generate mock analysis for demo when no API keys are configured
 */
function generateMockAnalysis(
  schema: SchemaColumn[],
  sampleData?: any[],
  fileName?: string
): SchemaIntelligenceResponse {
  const columns = schema.map(col => col.name.toLowerCase())

  // Smart detection based on column names
  const primaryKeys: string[] = []
  const foreignKeys: Array<{ column: string; referencesTable: string }> = []
  const temporalColumns: string[] = []
  const measureColumns: string[] = []
  const dimensionColumns: string[] = []
  const classifications: ColumnClassification[] = []

  // Infer table name from file name
  const tableName = fileName
    ? fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, '_').toLowerCase()
    : 'data_table'

  // Extract likely table entity (e.g., 'loan_applications' -> 'application')
  const tableEntity = tableName.replace(/s$/, '').split('_').pop() || ''

  for (const col of schema) {
    const name = col.name.toLowerCase()
    const type = col.type.toLowerCase()

    let role: ColumnClassification['role'] = 'attribute'
    let confidence: ColumnClassification['confidence'] = 'medium'
    let reasoning = ''

    // Primary Key detection - look for THIS table's ID
    if (name === 'id' || name === `${tableEntity}_id` || name === `${tableName.replace(/s$/, '')}_id`) {
      primaryKeys.push(col.name)
      role = 'primary_key'
      confidence = 'high'
      reasoning = 'Appears to be the primary identifier for this table'
    }
    // Foreign Key detection - IDs that reference other tables
    else if (name.endsWith('_id') && name !== 'id') {
      const refTable = name.replace(/_id$/, '') + 's'
      foreignKeys.push({ column: col.name, referencesTable: refTable })
      role = 'foreign_key'
      confidence = 'high'
      reasoning = `References ${refTable} table`
    }
    // Temporal columns
    else if (name.includes('date') || name.includes('_at') || name.includes('time') || type === 'date' || type === 'datetime' || type === 'timestamp') {
      temporalColumns.push(col.name)
      role = 'temporal'
      confidence = 'high'
      reasoning = 'Date/time column suitable for partitioning'
    }
    // Measure columns (numeric values for aggregation)
    else if (
      (type === 'number' || type === 'decimal' || type === 'integer' || type === 'float') &&
      (name.includes('amount') || name.includes('price') || name.includes('cost') ||
       name.includes('total') || name.includes('quantity') || name.includes('count') ||
       name.includes('rate') || name.includes('score') || name.includes('value') ||
       name.includes('income') || name.includes('payment'))
    ) {
      measureColumns.push(col.name)
      role = 'measure'
      confidence = 'high'
      reasoning = 'Numeric value suitable for aggregation'
    }
    // Dimension columns (categorical)
    else if (
      name.includes('status') || name.includes('type') || name.includes('category') ||
      name.includes('name') || name.includes('code') || name.includes('level') ||
      type === 'string' || type === 'boolean'
    ) {
      dimensionColumns.push(col.name)
      role = 'dimension'
      confidence = 'medium'
      reasoning = 'Categorical column for grouping/filtering'
    }

    classifications.push({
      name: col.name,
      inferredType: type,
      role,
      confidence,
      reasoning: reasoning || 'General attribute column'
    })
  }

  // Determine table type
  let tableType: 'fact' | 'dimension' | 'transactional' | 'reference' = 'transactional'
  if (measureColumns.length > 2 && temporalColumns.length > 0) {
    tableType = 'fact'
  } else if (measureColumns.length === 0 && dimensionColumns.length > 3) {
    tableType = 'dimension'
  }

  // Generate summary
  const summary = primaryKeys.length > 0
    ? `${tableName.replace(/_/g, ' ')} data with ${schema.length} columns, keyed by ${primaryKeys[0]}`
    : `${tableName.replace(/_/g, ' ')} data with ${schema.length} columns`

  // Data quality hints
  const dataQualityHints: string[] = []
  if (primaryKeys.length === 0) {
    dataQualityHints.push('No clear primary key detected - consider adding a unique identifier')
  }
  if (temporalColumns.length > 0) {
    dataQualityHints.push(`Use ${temporalColumns[0]} for incremental loading and partitioning`)
  }
  if (foreignKeys.length > 0) {
    dataQualityHints.push(`${foreignKeys.length} foreign key relationship(s) detected - ensure referential integrity`)
  }

  return {
    primaryKeys,
    foreignKeys,
    temporalColumns,
    measureColumns,
    dimensionColumns,
    classifications,
    suggestedTableName: tableName,
    tableType,
    summary,
    dataQualityHints
  }
}
