import { NextRequest, NextResponse } from 'next/server'
import { openai } from '@/lib/ai/openai-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
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
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const aiResponse = completion.choices[0].message.content
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
      console.error('❌ AI header detection failed:', aiError)

      // Fallback: Use simple heuristic
      const firstRow = firstThreeRows[0].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))
      const secondRow = firstThreeRows[1].split(',').map((h: string) => h.trim().replace(/^"|"$/g, ''))

      // Simple heuristic: if first row values are short and descriptive, assume headers
      const avgFirstRowLength = firstRow.reduce((sum: number, val: string) => sum + val.length, 0) / firstRow.length
      const avgSecondRowLength = secondRow.reduce((sum: number, val: string) => sum + val.length, 0) / secondRow.length
      const hasNumericPattern = secondRow.some((val: string) => !isNaN(Number(val)) && val.trim() !== '')

      const likelyHasHeaders = avgFirstRowLength < avgSecondRowLength * 0.7 && hasNumericPattern

      const result: HeaderDetectionResult = {
        success: true,
        headerDetection: {
          hasHeader: likelyHasHeaders,
          confidence: 60,
          reasoning: 'AI analysis unavailable. Using heuristic: first row appears to be ' + (likelyHasHeaders ? 'headers' : 'data'),
          needsUserInput: true,
          suggestedHeaders: likelyHasHeaders ? firstRow : undefined,
          headerQuality: 'poor'
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
