import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/ai/openai-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ColumnSuggestion {
  position: number
  originalName?: string
  suggestedName: string
  reasoning: string
  dataType: string
  sampleValues: string[]
  confidence: number
}

interface SchemaResult {
  success: boolean
  schema: {
    needsColumnNaming: boolean
    aiSuggestedColumns?: ColumnSuggestion[]
    suggestedHeaders: string[]
  }
  progress: number
  error?: string
}

/**
 * Step 3 of 3: Column naming and schema generation (100% progress)
 * Suggests intelligent column names for CSVs without headers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstThreeRows, hasHeader, rowCount } = body

    if (!firstThreeRows || !Array.isArray(firstThreeRows) || firstThreeRows.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request: firstThreeRows is required',
        progress: 70
      }, { status: 400 })
    }

    console.log('🤖 Step 3/3: Schema generation starting...')

    // If CSV has headers, just return them
    if (hasHeader) {
      const headers = firstThreeRows[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))

      const result: SchemaResult = {
        success: true,
        schema: {
          needsColumnNaming: false,
          suggestedHeaders: headers
        },
        progress: 100
      }

      console.log('✅ Step 3/3 complete: Using existing headers (100%)')
      return NextResponse.json(result)
    }

    // No headers - use AI to suggest intelligent column names
    console.log('🤖 No headers detected. Asking AI for intelligent column names...')

    try {
      const columnNamingCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert data analyst. Analyze CSV data (without headers) and suggest meaningful column names.

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
}`
          },
          {
            role: 'user',
            content: `Analyze this CSV data and suggest column names:\n\nRow 1: ${firstThreeRows[0]}\nRow 2: ${firstThreeRows[1]}\nRow 3: ${firstThreeRows[2] || 'N/A'}\n\nSuggest intelligent column names for each column.`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const columnNamingResponse = columnNamingCompletion.choices[0].message.content
      if (!columnNamingResponse) {
        throw new Error('No response from AI')
      }

      const columnNaming = JSON.parse(columnNamingResponse)
      console.log('🤖 AI Column Naming Suggestions:', columnNaming)

      // Parse first 5 rows from the provided data to get sample values
      const allRows = [firstThreeRows[0], firstThreeRows[1], firstThreeRows[2] || '']
        .filter(row => row)
        .map(line => line.split(',').map((cell: string) => cell.trim().replace(/^"|"$/g, '')))

      const aiSuggestedColumns: ColumnSuggestion[] = columnNaming.columns.map((col: any) => {
        const sampleValues = allRows.map(row => row[col.position - 1] || '').slice(0, 3)
        return {
          position: col.position,
          suggestedName: col.suggestedName,
          reasoning: col.reasoning,
          dataType: col.dataType,
          sampleValues,
          confidence: col.confidence
        }
      })

      const result: SchemaResult = {
        success: true,
        schema: {
          needsColumnNaming: true,
          aiSuggestedColumns,
          suggestedHeaders: columnNaming.columns.map((col: any) => col.suggestedName)
        },
        progress: 100
      }

      console.log('✅ Step 3/3 complete: AI column names generated (100%)')
      return NextResponse.json(result)

    } catch (aiError) {
      console.error('❌ AI column naming failed:', aiError)

      // Fallback to auto-generated names
      const firstRowColumns = firstThreeRows[0].split(',').length
      const fallbackHeaders = Array.from(
        { length: firstRowColumns },
        (_, i) => `Column_${i + 1}`
      )

      const result: SchemaResult = {
        success: true,
        schema: {
          needsColumnNaming: true,
          suggestedHeaders: fallbackHeaders
        },
        progress: 100
      }

      console.log('⚠️ Step 3/3 complete with fallback names (100%)')
      return NextResponse.json(result)
    }

  } catch (error) {
    console.error('❌ Schema generation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Schema generation failed',
        progress: 70
      },
      { status: 500 }
    )
  }
}
