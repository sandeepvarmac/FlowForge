import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/ai/anthropic-client'
import { openai } from '@/lib/ai/openai-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

interface HeaderDetectionResult {
  success: boolean
  headerDetection: {
    hasHeader: boolean
    confidence: number
    reasoning: string
    needsUserInput: boolean
    suggestedHeaders?: string[]
    headerQuality?: 'excellent' | 'good' | 'poor'
  }
  progress: number
  error?: string
}

/**
 * Step 2 of 3: AI-powered header detection (70% progress)
 * Uses OpenAI to detect if CSV has headers and extract them
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { firstThreeRows } = body

    if (!firstThreeRows || !Array.isArray(firstThreeRows) || firstThreeRows.length < 2) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request: firstThreeRows is required',
        progress: 30
      }, { status: 400 })
    }

    console.log('🤖 Step 2/3: AI header detection starting...')

    try {
      const completion = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 1000,
        system: `You are a CSV data analyst expert. Your job is to determine if a CSV file has a header row.

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
}`,
        messages: [
          { role: 'user', content: `Analyze if this CSV has a header row:\n\nRow 1: ${firstThreeRows[0]}\nRow 2: ${firstThreeRows[1]}\nRow 3: ${firstThreeRows[2] || 'N/A'}` }
        ]
      })

      const aiResponse = (completion.content?.find((c: any) => c.type === 'text') as any)?.text
      if (!aiResponse) {
        throw new Error('No response from AI')
      }

      const headerAnalysis = JSON.parse(aiResponse)
      console.log('🤖 AI Header Analysis:', headerAnalysis)

      const result: HeaderDetectionResult = {
        success: true,
        headerDetection: {
          hasHeader: headerAnalysis.hasHeader,
          confidence: headerAnalysis.confidence,
          reasoning: headerAnalysis.reasoning,
          needsUserInput: headerAnalysis.confidence < 80 // Ask user if confidence is low
        },
        progress: 70
      }

      // If AI detects headers with high confidence, extract them
      if (headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
        const headers = firstThreeRows[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
        result.headerDetection.suggestedHeaders = headers
        result.headerDetection.headerQuality = headerAnalysis.confidence >= 95 ? 'excellent' : 'good'
        console.log('✅ Headers detected:', headers.slice(0, 5).join(', '), '...')
      } else if (!headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
        // No headers detected - column naming will be handled in step 3
        result.headerDetection.needsUserInput = true
        console.log('⚠️ No headers detected - will need column naming in step 3')
      } else {
        // Low confidence - ask user
        result.headerDetection.needsUserInput = true
        result.headerDetection.headerQuality = 'poor'
        console.log('⚠️ Low confidence header detection - user input needed')
      }

      console.log('✅ Step 2/3 complete: Header detection finished (70%)')
      return NextResponse.json(result)

    } catch (aiError) {
      console.error('❌ Anthropic AI header detection failed:', aiError)

      // Try OpenAI fallback before using heuristic
      if (process.env.OPENAI_API_KEY) {
        try {
          console.log('🔄 Trying OpenAI fallback...')
          const completion = await openai.chat.completions.create({
            model: OPENAI_MODEL,
            messages: [
              {
                role: 'system',
                content: `You are a CSV data analyst expert. Your job is to determine if a CSV file has a header row.

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
              },
              {
                role: 'user',
                content: `Analyze if this CSV has a header row:\n\nRow 1: ${firstThreeRows[0]}\nRow 2: ${firstThreeRows[1]}\nRow 3: ${firstThreeRows[2] || 'N/A'}`
              }
            ],
            response_format: { type: 'json_object' }
          })

          const aiResponse = completion.choices[0]?.message?.content
          if (!aiResponse) {
            throw new Error('No response from OpenAI')
          }

          const headerAnalysis = JSON.parse(aiResponse)
          console.log('✅ OpenAI Header Analysis:', headerAnalysis)

          const result: HeaderDetectionResult = {
            success: true,
            headerDetection: {
              hasHeader: headerAnalysis.hasHeader,
              confidence: headerAnalysis.confidence,
              reasoning: headerAnalysis.reasoning + ' (via OpenAI fallback)',
              needsUserInput: headerAnalysis.confidence < 80
            },
            progress: 70
          }

          // If AI detects headers with high confidence, extract them
          if (headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
            const headers = firstThreeRows[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
            result.headerDetection.suggestedHeaders = headers
            result.headerDetection.headerQuality = headerAnalysis.confidence >= 95 ? 'excellent' : 'good'
            console.log('✅ Headers detected via OpenAI:', headers.slice(0, 5).join(', '), '...')
          }

          console.log('✅ Step 2/3 complete: Header detection finished via OpenAI fallback (70%)')
          return NextResponse.json(result)

        } catch (openaiError) {
          console.error('❌ OpenAI fallback also failed:', openaiError)
          // Fall through to heuristic
        }
      }

      // Final fallback: Use improved heuristic
      const firstRow = firstThreeRows[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
      const secondRow = firstThreeRows[1].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))

      // Improved heuristic checks:
      // 1. Does first row contain underscore/snake_case patterns (common in headers)?
      const hasSnakeCase = firstRow.some((val: string) => val.includes('_'))

      // 2. Does first row contain only alphanumeric + underscores (no special chars like @, dates, numbers)?
      const firstRowIsDescriptive = firstRow.every((val: string) =>
        /^[a-zA-Z][a-zA-Z0-9_]*$/.test(val) || /^[A-Z][a-z\s]+$/.test(val)
      )

      // 3. Does second row contain actual data (emails, numbers, dates)?
      const secondRowHasData = secondRow.some((val: string) =>
        !isNaN(Number(val)) || // numbers
        val.includes('@') ||    // emails
        /\d{4}-\d{2}-\d{2}/.test(val) || // dates
        /\(\d{3}\)/.test(val)   // phone numbers
      )

      const likelyHasHeaders = (hasSnakeCase || firstRowIsDescriptive) && secondRowHasData

      const result: HeaderDetectionResult = {
        success: true,
        headerDetection: {
          hasHeader: likelyHasHeaders,
          confidence: likelyHasHeaders ? 85 : 70, // Higher confidence when headers detected
          reasoning: 'AI analysis unavailable. Using heuristic: first row appears to be ' + (likelyHasHeaders ? 'headers (detected snake_case/descriptive names)' : 'data'),
          needsUserInput: !likelyHasHeaders, // Only ask user if we think there are NO headers
          suggestedHeaders: likelyHasHeaders ? firstRow : undefined,
          headerQuality: likelyHasHeaders ? 'good' : 'poor'
        },
        progress: 70
      }

      console.log('⚠️ Step 2/3 complete with fallback (70%)')
      return NextResponse.json(result)
    }

  } catch (error) {
    console.error('❌ Header detection error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Header detection failed',
        progress: 30
      },
      { status: 500 }
    )
  }
}
