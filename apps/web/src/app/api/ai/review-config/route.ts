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
  try {
    const body: ReviewRequest = await request.json()
    const { sourceConfig, destinationConfig, schema, previewData, sourceName, sourceType } = body

    // Check if Anthropic API key is configured
    const apiKey = process.env.ANTHROPIC_API_KEY

    if (!apiKey || apiKey === 'your_anthropic_api_key_here') {
      // Return mock response for demo/development
      return NextResponse.json({
        review: generateMockReview(destinationConfig, schema, sourceName)
      })
    }

    // Use Anthropic API for real review
    const client = new Anthropic({ apiKey })

    const prompt = buildReviewPrompt(sourceConfig, destinationConfig, schema, previewData, sourceName, sourceType)

    const message = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    })

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
    return NextResponse.json({ review })

  } catch (error) {
    console.error('[AI Review] Error:', error)

    // Return mock response on error for demo purposes
    const body: ReviewRequest = await request.clone().json()
    return NextResponse.json({
      review: generateMockReview(body.destinationConfig, body.schema, body.sourceName)
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

  // Check for risk flags based on configuration

  // Risk: Full rebuild on large datasets
  if (goldConfig.buildStrategy === 'full_rebuild' && schema.length > 15) {
    riskFlags.push({
      severity: 'medium',
      category: 'performance',
      message: 'Full rebuild strategy on dataset with many columns',
      recommendation: 'Consider incremental builds for large datasets to reduce processing time'
    })
  }

  // Risk: No data quality checks
  const hasNumericColumns = schema.some(col => col.type === 'number' || col.type === 'integer')
  if (hasNumericColumns && !silverConfig.qualityRules?.length) {
    riskFlags.push({
      severity: 'medium',
      category: 'data_quality',
      message: 'No data quality rules defined for numeric columns',
      recommendation: 'Add range validation and null checks for critical numeric fields'
    })
  }

  // Risk: No deduplication on ID columns
  const hasIdColumns = schema.some(col => col.name.toLowerCase().includes('_id') || col.name.toLowerCase() === 'id')
  if (hasIdColumns && !silverConfig.deduplicationEnabled) {
    riskFlags.push({
      severity: 'high',
      category: 'data_quality',
      message: 'Deduplication not enabled despite ID columns present',
      recommendation: 'Enable deduplication using the primary key columns to prevent duplicate records'
    })
  }

  // Bronze recommendations
  if (bronzeConfig.storageFormat !== 'parquet') {
    bronzeRecommendations.push({
      field: 'storageFormat',
      currentValue: bronzeConfig.storageFormat || 'not set',
      suggestedValue: 'parquet',
      reasoning: 'Parquet provides optimal compression and query performance for analytical workloads'
    })
  }

  if (bronzeConfig.compression !== 'zstd') {
    bronzeRecommendations.push({
      field: 'compression',
      currentValue: bronzeConfig.compression || 'not set',
      suggestedValue: 'zstd',
      reasoning: 'Zstandard offers the best balance of compression ratio and speed'
    })
  }

  // Check for date columns for partitioning
  const dateColumns = schema.filter(col =>
    col.type === 'date' || col.type === 'datetime' ||
    col.name.toLowerCase().includes('date') || col.name.toLowerCase().includes('_at')
  )
  if (dateColumns.length > 0 && !bronzeConfig.partitionColumn) {
    bronzeRecommendations.push({
      field: 'partitionColumn',
      currentValue: null,
      suggestedValue: dateColumns[0].name,
      reasoning: `Partitioning by ${dateColumns[0].name} will improve query performance for time-based analytics`
    })
  }

  // Silver recommendations
  if (!silverConfig.deduplicationEnabled && hasIdColumns) {
    const pkColumn = schema.find(col => col.name.toLowerCase() === 'id' || col.name.toLowerCase().endsWith('_id'))
    silverRecommendations.push({
      field: 'deduplicationEnabled',
      currentValue: false,
      suggestedValue: true,
      reasoning: `Enable deduplication using ${pkColumn?.name || 'primary key'} to ensure data integrity`
    })
  }

  if (!silverConfig.nullHandling || silverConfig.nullHandling === 'keep') {
    silverRecommendations.push({
      field: 'nullHandling',
      currentValue: silverConfig.nullHandling || 'keep',
      suggestedValue: 'coalesce',
      reasoning: 'Coalesce nulls to default values for consistent downstream processing'
    })
  }

  // Gold recommendations
  const amountColumns = schema.filter(col =>
    col.name.toLowerCase().includes('amount') ||
    col.name.toLowerCase().includes('quantity') ||
    col.name.toLowerCase().includes('value')
  )

  if (!goldConfig.tableType) {
    const suggestedType = amountColumns.length > 0 ? 'fact' : 'dimension'
    goldRecommendations.push({
      field: 'tableType',
      currentValue: null,
      suggestedValue: suggestedType,
      reasoning: amountColumns.length > 0
        ? 'Contains numeric measures (amounts/quantities), suitable as a Fact table'
        : 'Contains descriptive attributes, suitable as a Dimension table'
    })
  }

  if (goldConfig.storageFormat !== 'duckdb') {
    goldRecommendations.push({
      field: 'storageFormat',
      currentValue: goldConfig.storageFormat || 'not set',
      suggestedValue: 'duckdb',
      reasoning: 'DuckDB provides fast analytical queries and is ideal for the Gold layer'
    })
  }

  // Calculate score
  let score = 100
  score -= riskFlags.filter(f => f.severity === 'high').length * 15
  score -= riskFlags.filter(f => f.severity === 'medium').length * 8
  score -= riskFlags.filter(f => f.severity === 'low').length * 3
  score -= bronzeRecommendations.length * 3
  score -= silverRecommendations.length * 4
  score -= goldRecommendations.length * 3
  score = Math.max(0, Math.min(100, score))

  // Generate summary
  const totalRecs = bronzeRecommendations.length + silverRecommendations.length + goldRecommendations.length
  let summary = ''
  if (score >= 85) {
    summary = `Good configuration for ${sourceName}. ${totalRecs > 0 ? `${totalRecs} minor improvements suggested.` : 'Ready for production.'}`
  } else if (score >= 60) {
    summary = `Configuration for ${sourceName} needs attention. Found ${riskFlags.length} risk(s) and ${totalRecs} recommended improvements.`
  } else {
    summary = `Configuration for ${sourceName} requires significant improvements. Address ${riskFlags.filter(f => f.severity === 'high').length} high-priority issues before deployment.`
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
