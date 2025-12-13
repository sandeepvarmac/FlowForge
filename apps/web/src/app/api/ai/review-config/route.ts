import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

interface ReviewRequest {
  sourceConfig: any
  destinationConfig: any
  schema: Array<{ name: string; type: string; sample?: string }>
  previewData?: any[]
  sourceName: string
  sourceType: string
}

interface RiskFlag {
  severity: 'high' | 'medium' | 'low'
  category: string
  message: string
  recommendation: string
}

interface Recommendation {
  field: string
  currentValue: any
  suggestedValue: any
  reasoning: string
}

interface AIReviewResponse {
  riskFlags: RiskFlag[]
  bronzeRecommendations: Recommendation[]
  silverRecommendations: Recommendation[]
  goldRecommendations: Recommendation[]
  overallScore: number
  summary: string
}

/**
 * POST /api/ai/review-config
 * AI Data Architect review of source configuration
 */
export async function POST(request: NextRequest) {
  let parsedBody: ReviewRequest | null = null
  try {
    parsedBody = await request.json() as ReviewRequest
    const { sourceConfig, destinationConfig, schema, previewData, sourceName, sourceType } = parsedBody

    console.log('[AI Review] Starting review for:', sourceName)
    console.log('[AI Review] Schema columns:', schema?.length || 0)
    console.log('[AI Review] Bronze config:', JSON.stringify(destinationConfig?.bronzeConfig || {}, null, 2))
    console.log('[AI Review] Silver config:', JSON.stringify(destinationConfig?.silverConfig || {}, null, 2))
    console.log('[AI Review] Gold config:', JSON.stringify(destinationConfig?.goldConfig || {}, null, 2))

    // Check if Anthropic API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      console.log('[AI Review] No API key configured, using enhanced mock review')
      // Return mock response for demo/development
      return NextResponse.json({
        review: generateMockReview(destinationConfig, schema, sourceName),
        _debug: { mode: 'mock', reason: 'no_api_key' }
      })
    }

    console.log('[AI Review] API key found, calling Anthropic...')

    // Use Anthropic API for real review
    const client = new Anthropic({ apiKey })

    const prompt = buildReviewPrompt(sourceConfig, destinationConfig, schema, previewData, sourceName, sourceType)

    let message
    try {
      message = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
      console.log('[AI Review] Anthropic call successful')
    } catch (apiErr: any) {
      // If Anthropic call fails (e.g., no credits), fall back to mock response
      console.error('[AI Review] Anthropic call failed:', apiErr?.message || apiErr)
      console.error('[AI Review] Full error:', JSON.stringify(apiErr, null, 2))
      return NextResponse.json({
        review: generateMockReview(destinationConfig, schema, sourceName),
        _debug: { mode: 'mock', reason: 'api_error', error: apiErr?.message }
      })
    }

    // Extract text content
    const textContent = message.content.find(block => block.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text response from AI')
    }

    // Parse the JSON response
    const jsonMatch = textContent.text.match(/```json\n?([\s\S]*?)\n?```/)
    if (!jsonMatch) {
      // Try to parse raw JSON
      const review = JSON.parse(textContent.text)
      return NextResponse.json({ review })
    }

    const review = JSON.parse(jsonMatch[1])
    return NextResponse.json({ review, _debug: { mode: 'ai', provider: 'anthropic' } })

  } catch (error) {
    console.error('[AI Review] Error:', error)

    // Return mock response on error for demo purposes (avoid re-reading request stream)
    const body: ReviewRequest = parsedBody || {
      sourceConfig: {},
      destinationConfig: {},
      schema: [],
      sourceName: 'Unknown Source',
      sourceType: 'unknown'
    }
    return NextResponse.json({
      review: generateMockReview(body.destinationConfig, body.schema, body.sourceName),
      _debug: { mode: 'mock', reason: 'parse_error', error: String(error) }
    })
  }
}

function buildReviewPrompt(
  sourceConfig: any,
  destinationConfig: any,
  schema: Array<{ name: string; type: string; sample?: string }>,
  previewData: any[] | undefined,
  sourceName: string,
  sourceType: string
): string {
  return `You are a Senior Data Architect reviewing a data pipeline configuration. Analyze the configuration and provide expert recommendations.

## Source Information
- Name: ${sourceName}
- Type: ${sourceType}
- Schema: ${schema.length} columns
${schema.slice(0, 20).map(col => `  - ${col.name} (${col.type})${col.sample ? `: sample="${col.sample}"` : ''}`).join('\n')}
${schema.length > 20 ? `  ... and ${schema.length - 20} more columns` : ''}

## Current Configuration

### Bronze Layer (Raw Data)
${JSON.stringify(destinationConfig.bronzeConfig || {}, null, 2)}

### Silver Layer (Cleaned/Validated)
${JSON.stringify(destinationConfig.silverConfig || {}, null, 2)}

### Gold Layer (Business-Ready)
${JSON.stringify(destinationConfig.goldConfig || {}, null, 2)}

## Your Task
Review this configuration as a Senior Data Architect and provide:

1. **Risk Flags**: Issues that could cause problems in production (e.g., missing partitioning for large datasets, full refresh on >100K rows, missing data quality checks on critical columns)

2. **Bronze Recommendations**: Improvements for raw data ingestion (storage format, compression, schema evolution, partitioning)

3. **Silver Recommendations**: Improvements for data quality (deduplication, null handling, type validation, transformations)

4. **Gold Recommendations**: Improvements for analytics (table type, indexing, aggregations, naming conventions)

5. **Overall Score**: 0-100 based on configuration quality

6. **Summary**: 1-2 sentence summary of the configuration quality

Respond with ONLY a JSON object in this exact format:
\`\`\`json
{
  "riskFlags": [
    {
      "severity": "high|medium|low",
      "category": "performance|data_quality|governance|security",
      "message": "Description of the risk",
      "recommendation": "How to fix it"
    }
  ],
  "bronzeRecommendations": [
    {
      "field": "fieldName",
      "currentValue": "current value or null",
      "suggestedValue": "recommended value",
      "reasoning": "Why this change improves the configuration"
    }
  ],
  "silverRecommendations": [...],
  "goldRecommendations": [...],
  "overallScore": 75,
  "summary": "Brief assessment of the configuration"
}
\`\`\``
}

function generateMockReview(
  destinationConfig: any,
  schema: Array<{ name: string; type: string; sample?: string }>,
  sourceName: string
): AIReviewResponse {
  const riskFlags: RiskFlag[] = []
  const bronzeRecommendations: Recommendation[] = []
  const silverRecommendations: Recommendation[] = []
  const goldRecommendations: Recommendation[] = []

  const bronzeConfig = destinationConfig?.bronzeConfig || {}
  const silverConfig = destinationConfig?.silverConfig || {}
  const goldConfig = destinationConfig?.goldConfig || {}

  // Analyze schema patterns
  const hasIdColumns = schema.some(col =>
    col.name.toLowerCase() === 'id' ||
    col.name.toLowerCase().endsWith('_id') ||
    col.name.toLowerCase().includes('_id_')
  )
  const hasNumericColumns = schema.some(col =>
    col.type === 'number' || col.type === 'integer' || col.type === 'float' || col.type === 'decimal'
  )
  const dateColumns = schema.filter(col =>
    col.type === 'date' || col.type === 'datetime' || col.type === 'timestamp' ||
    col.name.toLowerCase().includes('date') ||
    col.name.toLowerCase().includes('_at') ||
    col.name.toLowerCase().includes('timestamp')
  )
  const amountColumns = schema.filter(col =>
    col.name.toLowerCase().includes('amount') ||
    col.name.toLowerCase().includes('quantity') ||
    col.name.toLowerCase().includes('value') ||
    col.name.toLowerCase().includes('price') ||
    col.name.toLowerCase().includes('total') ||
    col.name.toLowerCase().includes('sum')
  )
  const emailColumns = schema.filter(col =>
    col.name.toLowerCase().includes('email')
  )
  const phoneColumns = schema.filter(col =>
    col.name.toLowerCase().includes('phone') || col.name.toLowerCase().includes('mobile')
  )
  const piiColumns = schema.filter(col =>
    col.name.toLowerCase().includes('ssn') ||
    col.name.toLowerCase().includes('social_security') ||
    col.name.toLowerCase().includes('credit_card') ||
    col.name.toLowerCase().includes('password') ||
    col.name.toLowerCase().includes('secret')
  )

  // ===== RISK FLAGS =====

  // Risk: PII columns detected without proper handling
  if (piiColumns.length > 0) {
    riskFlags.push({
      severity: 'high',
      category: 'security',
      message: `Potential PII columns detected: ${piiColumns.map(c => c.name).join(', ')}`,
      recommendation: 'Consider masking or encrypting sensitive columns. Add data classification metadata and implement row-level security if applicable.'
    })
  }

  // Risk: Full rebuild on large datasets - only flag if BOTH Bronze and Gold use full refresh
  const bronzeIsFullRefresh = !bronzeConfig.loadStrategy || bronzeConfig.loadStrategy === 'full_refresh'
  const goldIsFullRebuild = goldConfig.buildStrategy === 'full_rebuild' || goldConfig.refreshStrategy === 'full_rebuild'

  if (bronzeIsFullRefresh && goldIsFullRebuild && schema.length > 10) {
    riskFlags.push({
      severity: 'medium',
      category: 'performance',
      message: `Full refresh/rebuild strategy across all layers on dataset with ${schema.length} columns may cause performance issues at scale`,
      recommendation: 'Consider incremental loading in Bronze and incremental builds in Gold to reduce processing time and costs'
    })
  } else if (goldIsFullRebuild && !bronzeIsFullRefresh && schema.length > 15) {
    // Bronze is incremental but Gold still does full rebuild - lower severity
    riskFlags.push({
      severity: 'low',
      category: 'performance',
      message: `Gold layer uses full rebuild while Bronze uses incremental loading`,
      recommendation: 'Consider incremental builds in Gold layer to fully leverage the incremental data pipeline'
    })
  }

  // Risk: No deduplication with ID columns present
  if (hasIdColumns && silverConfig.mergeStrategy !== 'merge' && !silverConfig.primaryKey) {
    riskFlags.push({
      severity: 'high',
      category: 'data_quality',
      message: 'ID columns detected but no primary key or merge strategy configured',
      recommendation: 'Set a primary key in Silver layer and use merge strategy to prevent duplicate records'
    })
  }

  // Risk: Append mode without deduplication
  if (bronzeConfig.loadStrategy === 'append' && silverConfig.mergeStrategy === 'append') {
    riskFlags.push({
      severity: 'medium',
      category: 'data_quality',
      message: 'Both Bronze and Silver using append mode may lead to duplicate data',
      recommendation: 'Use merge strategy in Silver layer with proper primary key for deduplication'
    })
  }

  // Risk: Large schema without partitioning
  if (schema.length > 15 && dateColumns.length > 0 && !bronzeConfig.partitionKeys?.length) {
    riskFlags.push({
      severity: 'medium',
      category: 'performance',
      message: `Large dataset (${schema.length} columns) with date columns but no partitioning configured`,
      recommendation: `Add partitioning on ${dateColumns[0].name} for improved query performance`
    })
  }

  // Risk: No audit columns enabled
  if (!bronzeConfig.auditColumns && !bronzeConfig.auditColumnsBatchId) {
    riskFlags.push({
      severity: 'low',
      category: 'governance',
      message: 'No audit columns enabled for data lineage tracking',
      recommendation: 'Enable audit columns (_ingested_at, _batch_id, _source_file) for better data governance'
    })
  }

  // ===== BRONZE RECOMMENDATIONS =====

  // Storage format
  if (bronzeConfig.storageFormat && bronzeConfig.storageFormat !== 'parquet' && bronzeConfig.storageFormat !== 'delta' && bronzeConfig.storageFormat !== 'iceberg') {
    bronzeRecommendations.push({
      field: 'storageFormat',
      currentValue: bronzeConfig.storageFormat,
      suggestedValue: 'parquet',
      reasoning: 'Parquet provides columnar storage with excellent compression and query performance for analytical workloads'
    })
  }

  // Compression
  if (bronzeConfig.compression && bronzeConfig.compression !== 'zstd' && bronzeConfig.compression !== 'snappy') {
    bronzeRecommendations.push({
      field: 'compression',
      currentValue: bronzeConfig.compression,
      suggestedValue: 'zstd',
      reasoning: 'Zstandard offers superior compression ratios while maintaining fast decompression speeds'
    })
  }

  // Partitioning recommendation
  if (dateColumns.length > 0 && !bronzeConfig.partitionKeys?.length && !bronzeConfig.partitionColumn) {
    const bestDateCol = dateColumns.find(c =>
      c.name.toLowerCase().includes('created') ||
      c.name.toLowerCase().includes('transaction') ||
      c.name.toLowerCase().includes('order')
    ) || dateColumns[0]
    bronzeRecommendations.push({
      field: 'partitionKeys',
      currentValue: 'none',
      suggestedValue: [bestDateCol.name],
      reasoning: `Partitioning by ${bestDateCol.name} enables partition pruning and significantly improves query performance for time-based analytics`
    })
  }

  // Load strategy based on data characteristics
  if (!bronzeConfig.loadStrategy || bronzeConfig.loadStrategy === 'full_refresh') {
    if (dateColumns.length > 0) {
      bronzeRecommendations.push({
        field: 'loadStrategy',
        currentValue: bronzeConfig.loadStrategy || 'not set',
        suggestedValue: 'incremental',
        reasoning: 'With date columns available, incremental loading reduces data transfer and processing time'
      })
    }
  }

  // ===== SILVER RECOMMENDATIONS =====

  // Primary key recommendation
  if (!silverConfig.primaryKey && hasIdColumns) {
    const idCol = schema.find(col =>
      col.name.toLowerCase() === 'id' ||
      col.name.toLowerCase().endsWith('_id')
    )
    if (idCol) {
      silverRecommendations.push({
        field: 'primaryKey',
        currentValue: 'not set',
        suggestedValue: idCol.name,
        reasoning: `Setting ${idCol.name} as primary key enables proper deduplication and merge operations`
      })
    }
  }

  // Merge strategy
  if (silverConfig.mergeStrategy === 'full_refresh' && hasIdColumns) {
    silverRecommendations.push({
      field: 'mergeStrategy',
      currentValue: 'full_refresh',
      suggestedValue: 'merge',
      reasoning: 'With primary key columns available, merge strategy provides efficient upserts and maintains data integrity'
    })
  }

  // Transformations for data quality
  if (emailColumns.length > 0 && !silverConfig.lowercaseEmails) {
    silverRecommendations.push({
      field: 'lowercaseEmails',
      currentValue: false,
      suggestedValue: true,
      reasoning: `Normalize ${emailColumns.map(c => c.name).join(', ')} to lowercase for consistent matching and joins`
    })
  }

  if (!silverConfig.trimWhitespace && schema.some(c => c.type === 'string' || c.type === 'text')) {
    silverRecommendations.push({
      field: 'trimWhitespace',
      currentValue: false,
      suggestedValue: true,
      reasoning: 'Trim whitespace from string columns to prevent data quality issues in downstream joins and aggregations'
    })
  }

  // SCD Type 2 for dimension tables
  if (!amountColumns.length && hasIdColumns && dateColumns.length > 0 && silverConfig.mergeStrategy !== 'scd_type_2') {
    silverRecommendations.push({
      field: 'mergeStrategy',
      currentValue: silverConfig.mergeStrategy || 'not set',
      suggestedValue: 'scd_type_2',
      reasoning: 'This appears to be a dimension table. Consider SCD Type 2 to track historical changes over time'
    })
  }

  // ===== GOLD RECOMMENDATIONS =====

  // Table type classification
  const detectedTableType = amountColumns.length > 0 ? 'fact' : 'dimension'
  if (goldConfig.tableType && goldConfig.tableType !== detectedTableType) {
    goldRecommendations.push({
      field: 'tableType',
      currentValue: goldConfig.tableType,
      suggestedValue: detectedTableType,
      reasoning: amountColumns.length > 0
        ? `Detected measure columns (${amountColumns.map(c => c.name).slice(0, 3).join(', ')}${amountColumns.length > 3 ? '...' : ''}) suggest this is a Fact table`
        : `No measure columns detected; descriptive columns suggest this is a Dimension table`
    })
  } else if (!goldConfig.tableType) {
    goldRecommendations.push({
      field: 'tableType',
      currentValue: 'not set',
      suggestedValue: detectedTableType,
      reasoning: amountColumns.length > 0
        ? `Contains numeric measures (${amountColumns.map(c => c.name).slice(0, 3).join(', ')}), suitable as a Fact table`
        : 'Contains descriptive attributes, suitable as a Dimension table'
    })
  }

  // Storage format for Gold
  if (goldConfig.storageFormat && goldConfig.storageFormat !== 'duckdb' && goldConfig.storageFormat !== 'parquet') {
    goldRecommendations.push({
      field: 'storageFormat',
      currentValue: goldConfig.storageFormat,
      suggestedValue: 'duckdb',
      reasoning: 'DuckDB provides fast OLAP queries and is optimal for the Gold analytical layer'
    })
  }

  // Build strategy for fact tables
  if (amountColumns.length > 0 && goldConfig.buildStrategy === 'full_rebuild' && dateColumns.length > 0) {
    goldRecommendations.push({
      field: 'buildStrategy',
      currentValue: 'full_rebuild',
      suggestedValue: 'incremental',
      reasoning: 'Fact tables with date columns benefit from incremental builds for better performance'
    })
  }

  // Naming convention check
  const tableName = goldConfig.tableName || bronzeConfig.tableName || ''
  if (tableName && !tableName.toLowerCase().startsWith('dim_') && !tableName.toLowerCase().startsWith('fact_') && !tableName.toLowerCase().startsWith('gold_')) {
    const prefix = detectedTableType === 'fact' ? 'fact_' : 'dim_'
    goldRecommendations.push({
      field: 'tableName',
      currentValue: tableName,
      suggestedValue: `${prefix}${tableName.replace(/^(dim_|fact_|gold_)/i, '')}`,
      reasoning: `Following naming conventions (${prefix}*) improves discoverability and self-documents the table purpose`
    })
  }

  // Calculate score based on actual issues found
  let score = 100
  score -= riskFlags.filter(f => f.severity === 'high').length * 15
  score -= riskFlags.filter(f => f.severity === 'medium').length * 8
  score -= riskFlags.filter(f => f.severity === 'low').length * 3
  score -= bronzeRecommendations.length * 3
  score -= silverRecommendations.length * 4
  score -= goldRecommendations.length * 3
  score = Math.max(0, Math.min(100, score))

  // Generate contextual summary
  const totalRecs = bronzeRecommendations.length + silverRecommendations.length + goldRecommendations.length
  const highRisks = riskFlags.filter(f => f.severity === 'high').length

  let summary = ''
  if (score >= 85) {
    summary = `Configuration for "${sourceName}" is well-structured with ${schema.length} columns. ${totalRecs > 0 ? `${totalRecs} optional improvements suggested.` : 'Ready for deployment.'}`
  } else if (score >= 60) {
    summary = `Configuration for "${sourceName}" (${schema.length} columns) needs refinement. Found ${riskFlags.length} risk flag(s) and ${totalRecs} recommendations to improve data quality and performance.`
  } else {
    summary = `Configuration for "${sourceName}" requires attention. Address ${highRisks} high-priority risk(s) before deployment. Key areas: ${riskFlags.slice(0, 2).map(r => r.category).join(', ')}.`
  }

  return {
    riskFlags,
    bronzeRecommendations,
    silverRecommendations,
    goldRecommendations,
    overallScore: score,
    summary
  }
}
