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

/**
 * AI-powered CSV validation
 * Validates file format, size, emptiness, and detects headers using AI
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided'
      }, { status: 400 })
    }

    console.log('🤖 AI-powered CSV validation starting for:', file.name)

    const result: CSVValidationResult = {
      success: true,
      validation: {
        fileFormat: { valid: false, message: '' },
        fileSize: { valid: false, sizeInMB: 0 },
        isEmpty: { valid: false },
        headerDetection: {
          hasHeader: false,
          confidence: 0,
          reasoning: '',
          needsUserInput: false
        }
      }
    }

    // 1. Validate file format (CSV only)
    const fileExtension = file.name.toLowerCase().split('.').pop()
    if (fileExtension !== 'csv') {
      result.validation.fileFormat = {
        valid: false,
        message: `Invalid file format: .${fileExtension}. Please upload a CSV file.`
      }
      result.success = false
      return NextResponse.json(result)
    }
    result.validation.fileFormat = {
      valid: true,
      message: 'Valid CSV file format'
    }

    // 2. Validate file size
    const sizeInMB = file.size / (1024 * 1024)
    result.validation.fileSize = {
      valid: true,
      sizeInMB: parseFloat(sizeInMB.toFixed(2))
    }

    // Add warning for medium-sized files (5-20 MB)
    if (sizeInMB >= 5 && sizeInMB < 20) {
      result.validation.fileSize.warning = `Large file detected (${sizeInMB.toFixed(1)} MB). Upload may take 10-20 seconds.`
      console.log('⚠️', result.validation.fileSize.warning)
    } else if (sizeInMB >= 20) {
      result.validation.fileSize.warning = `Very large file (${sizeInMB.toFixed(1)} MB). Upload may take 30-60 seconds. Consider using pattern matching for multiple files.`
      console.log('⚠️', result.validation.fileSize.warning)
    }

    // 3. Check if file is empty
    const fileContent = await file.text()
    const lines = fileContent.trim().split(/\r?\n/).filter(line => line.trim())

    if (lines.length === 0) {
      result.validation.isEmpty = {
        valid: false,
        message: 'CSV file is empty. Please upload a file with data.'
      }
      result.success = false
      return NextResponse.json(result)
    }

    if (lines.length === 1) {
      result.validation.isEmpty = {
        valid: false,
        message: 'CSV file contains only one row. Please upload a file with at least a header and one data row.'
      }
      result.success = false
      return NextResponse.json(result)
    }

    result.validation.isEmpty = {
      valid: true,
      message: `File contains ${lines.length} rows`
    }

    // 4. AI-powered header detection
    console.log('🤖 Running AI header detection...')

    // Get first 3 rows for analysis
    const firstThreeRows = lines.slice(0, 3)

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
        console.log('✅ Headers detected:', headers.slice(0, 5).join(', '), '...')
      } else if (!headerAnalysis.hasHeader && headerAnalysis.confidence >= 80) {
        // No headers detected - use AI to suggest intelligent column names
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
          if (columnNamingResponse) {
            const columnNaming = JSON.parse(columnNamingResponse)
            console.log('🤖 AI Column Naming Suggestions:', columnNaming)

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
            console.log('✅ AI suggested column names:', result.validation.headerDetection.suggestedHeaders?.slice(0, 5).join(', '), '...')
          }
        } catch (columnNamingError) {
          console.error('❌ AI column naming failed:', columnNamingError)
          // Fallback to auto-generated names
          const firstRowColumns = firstThreeRows[0].split(',').length
          result.validation.headerDetection.suggestedHeaders = Array.from(
            { length: firstRowColumns },
            (_, i) => `Column_${i + 1}`
          )
          console.log('⚠️ Falling back to auto-generated names:', result.validation.headerDetection.suggestedHeaders.slice(0, 5).join(', '), '...')
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
