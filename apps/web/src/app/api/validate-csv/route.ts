import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/ai/anthropic-client'
import { openai } from '@/lib/ai/openai-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

interface ColumnSuggestion {
  position: number
  originalName?: string
  suggestedName: string
  reasoning: string
  dataType: string
  sampleValues: string[]
  confidence: number
}

interface CSVValidationResult {
  success: boolean
  validation: {
    fileFormat: {
      valid: boolean
      message: string
    }
    fileSize: {
      valid: boolean
      sizeInMB: number
      warning?: string
    }
    isEmpty: {
      valid: boolean
      message?: string
    }
    headerDetection: {
      hasHeader: boolean
      confidence: number
      suggestedHeaders?: string[]
      reasoning: string
      needsUserInput: boolean
      aiSuggestedColumns?: ColumnSuggestion[]
      headerQuality?: 'excellent' | 'good' | 'poor'
    }
  }
  error?: string
}

async function requestAiJson({
  systemPrompt,
  userPrompt,
  maxTokens = 1000
}: {
  systemPrompt: string
  userPrompt: string
  maxTokens?: number
}): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    const headerPromptSystem = `You are a CSV data analyst expert. Your job is to determine if a CSV file has a header row.

Analyze the first few rows and determine:
1. Does the first row contain column headers (descriptive names) or actual data values?
2. Do the subsequent rows contain data that aligns with the first row being headers?
3. What is your confidence level (0-100)?

Consider:
- Headers typically use snake_case, camelCase, or Title Case (e.g., "customer_id", "firstName", "Order Date")
- Headers are descriptive names, not values (e.g., "age" vs "25", "email" vs "john@email.com")
- Data rows contain actual values that match the data types suggested by headers
- If the first row looks like data (numbers, emails, dates), it's probably not a header

Return ONLY valid JSON in this exact format:
{
  "hasHeader": true or false,
  "confidence": 0-100,
  "reasoning": "brief explanation in one sentence"
}`
    const headerPromptUser = `Analyze if this CSV has a header row:

Row 1: ${firstThreeRows[0]}
Row 2: ${firstThreeRows[1]}
Row 3: ${firstThreeRows[2] || 'N/A'}`

    try {
      const aiResponse = await requestAiJson({
        systemPrompt: headerPromptSystem,
        userPrompt: headerPromptUser,
        maxTokens: 1000
      })

      if (!aiResponse) {
        throw new Error('No response from AI provider')
      }

      const headerAnalysis = JSON.parse(aiResponse)
      console.log('dY- AI Header Analysis:', headerAnalysis)

      result.validation.headerDetection = {
        hasHeader: headerAnalysis.hasHeader,
        confidence: headerAnalysis.confidence,
        reasoning: headerAnalysis.reasoning,
        needsUserInput: headerAnalysis.confidence < 80 // Ask user if confidence is low
      }

      // If AI detects headers with high confidence, extract them
      if (headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
        const headers = firstThreeRows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
        result.validation.headerDetection.suggestedHeaders = headers
        console.log('?o. Headers detected:', headers.slice(0, 5).join(', '), '...')
      } else if (!headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
        // No headers detected - use AI to suggest intelligent column names
        console.log('dY- No headers detected. Asking AI for intelligent column names...')

        try {
          const columnNamingResponse = await requestAiJson({
            systemPrompt: `You are an expert data analyst. Analyze CSV data (without headers) and suggest meaningful column names.

For each column, provide:
1. A descriptive, snake_case column name
2. Brief reasoning (why this name fits the data)
3. Data type (string, integer, decimal, email, phone, date, boolean, etc.)
4. Confidence score (0-100)

Guidelines:
- Use snake_case (e.g., customer_id, email_address, registration_date)
- Be specific, not generic (not "data" or "value", but "order_total" or "customer_age")
- Consider relationships (if col 1 is customer_id, col 2 might be customer_name)
- For IDs, use entity_id format (customer_id, order_id, product_id)
- For amounts, include currency or unit if obvious (price_usd, weight_kg)
- For dates/times, be specific (created_at, registration_date, last_login)

Return ONLY valid JSON in this exact format:
{
  "columns": [
    {
      "position": 1,
      "suggestedName": "customer_id",
      "reasoning": "Sequential unique integers starting from 1",
      "dataType": "integer",
      "confidence": 90
    }
  ]
}` ,
            userPrompt: `Analyze this CSV data and suggest column names:

Row 1: ${firstThreeRows[0]}
Row 2: ${firstThreeRows[1]}
Row 3: ${firstThreeRows[2] || 'N/A'}

Suggest intelligent column names for each column.`,
            maxTokens: 1200
          })

          if (columnNamingResponse) {
            const columnNaming = JSON.parse(columnNamingResponse)
            console.log('dY- AI Column Naming Suggestions:', columnNaming)

            // Parse first 5 rows to get sample values for each column
            const first5Rows = lines.slice(0, 5).map(line =>
              line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
            )

            result.validation.headerDetection.aiSuggestedColumns = columnNaming.columns.map((col: any) => {
              const sampleValues = first5Rows.map(row => row[col.position - 1] || '').slice(0, 3)
              return {
                position: col.position,
                suggestedName: col.suggestedName,
                reasoning: col.reasoning,
                dataType: col.dataType,
                sampleValues,
                confidence: col.confidence
              }
            })

            result.validation.headerDetection.suggestedHeaders = columnNaming.columns.map((col: any) => col.suggestedName)
            result.validation.headerDetection.needsUserInput = true // Always ask user to review AI suggestions
            console.log('?o. AI suggested column names:', result.validation.headerDetection.suggestedHeaders?.slice(0, 5).join(', '), '...')
          }
        } catch (columnNamingError) {
          console.error('??O AI column naming failed:', columnNamingError)
          // Fallback to auto-generated names
          const firstRowColumns = firstThreeRows[0].split(',').length
          result.validation.headerDetection.suggestedHeaders = Array.from(
            { length: firstRowColumns },
            (_, i) => `Column_${i + 1}`
          )
          console.log('?s??,? Falling back to auto-generated names:', result.validation.headerDetection.suggestedHeaders.slice(0, 5).join(', '), '...')
        }
      }

    } catch (aiError) {
      console.error('❌ AI header detection failed:', aiError)
      // Fallback: Use simple heuristic
      const firstRow = firstThreeRows[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
      const secondRow = firstThreeRows[1].split(',').map(h => h.trim().replace(/^"|"$/g, ''))

      // Simple heuristic: if first row values are short and descriptive, assume headers
      const avgFirstRowLength = firstRow.reduce((sum, val) => sum + val.length, 0) / firstRow.length
      const avgSecondRowLength = secondRow.reduce((sum, val) => sum + val.length, 0) / secondRow.length
      const hasNumericPattern = secondRow.some(val => !isNaN(Number(val)) && val.trim() !== '')

      const likelyHasHeaders = avgFirstRowLength < avgSecondRowLength * 0.7 && hasNumericPattern

      result.validation.headerDetection = {
        hasHeader: likelyHasHeaders,
        confidence: 60,
        reasoning: 'AI analysis unavailable. Using heuristic: first row appears to be ' + (likelyHasHeaders ? 'headers' : 'data'),
        needsUserInput: true,
        suggestedHeaders: likelyHasHeaders ? firstRow : Array.from({ length: firstRow.length }, (_, i) => `Column_${i + 1}`)
      }
    }

    console.log('✅ CSV validation complete:', {
      format: result.validation.fileFormat.valid,
      size: result.validation.fileSize.sizeInMB + ' MB',
      hasHeaders: result.validation.headerDetection.hasHeader,
      confidence: result.validation.headerDetection.confidence + '%'
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ CSV validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      },
      { status: 500 }
    )
  }
}
