import { NextRequest, NextResponse } from 'next/server'
import { saveUploadedFile, getFileHash, readFile } from '@/lib/storage'
import { analyzeSchemaWithAI } from '@/lib/ai/anthropic-client'
import { analyzePrimaryKeyCandidates } from '@/lib/ai/primary-key-detector'
import { getDatabase } from '@/lib/db'
import Papa from 'papaparse'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/upload
 * Upload CSV file and get AI-powered schema analysis
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const workflowId = formData.get('workflowId') as string
    const jobId = formData.get('jobId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!workflowId || !jobId) {
      return NextResponse.json(
        { error: 'workflowId and jobId are required' },
        { status: 400 }
      )
    }

    console.log(`📁 Uploading file: ${file.name} for job ${jobId}`)

    // Read file once to reuse across operations
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Save file to storage
    const filepath = await saveUploadedFile(workflowId, jobId, file, fileBuffer)

    // Parse CSV for analysis (use same buffer to avoid duplicate reads)
    const fileContent = fileBuffer.toString('utf-8')
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      preview: 20 // Only parse first 20 rows for analysis
    })

    const data = parseResult.data as any[]
    const headers = parseResult.meta.fields || []

    // Detect basic types
    const detectDataType = (value: string): string => {
      if (!value || value.trim() === '') return 'string'
      const trimmed = value.trim()

      if (!isNaN(Number(trimmed)) && !(/^[\+\-\(\)\s\d]+$/.test(trimmed) && trimmed.length > 7)) {
        return trimmed.includes('.') ? 'decimal' : 'integer'
      }

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && !isNaN(Date.parse(trimmed))) {
        return 'date'
      }

      if (/@/.test(trimmed) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return 'email'
      }

      if (/[\+\d\s\-\(\)\.]+/.test(trimmed) && /\d/.test(trimmed)) {
        return 'phone'
      }

      return 'string'
    }

    const columns = headers.map(header => {
      const samples = data.map(row => row[header]).filter(v => v)
      const types = samples.slice(0, 10).map(detectDataType)
      const mostCommonType = types.reduce((a, b, i, arr) =>
        arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b
      , 'string')

      return {
        name: header,
        type: mostCommonType,
        sample: samples[0] || ''
      }
    })

    // Get file hash for caching
    const fileHash = getFileHash(fileBuffer)

    // Check if we have cached AI analysis
    const db = getDatabase()
    const cached = db.prepare(
      'SELECT ai_enhanced_schema, ai_suggestions FROM ai_schema_analysis WHERE file_hash = ?'
    ).get(fileHash) as any

    let aiAnalysis

    if (cached) {
      console.log('✨ Using cached AI analysis')
      aiAnalysis = {
        enhancedSchema: JSON.parse(cached.ai_enhanced_schema),
        suggestions: JSON.parse(cached.ai_suggestions)
      }
    } else {
      console.log('🤖 Running AI schema analysis...')
      // Run AI analysis
      const aiResult = await analyzeSchemaWithAI(columns, data)

      aiAnalysis = {
        enhancedSchema: aiResult.columns,
        suggestions: {
          dataQuality: aiResult.dataQualitySuggestions,
          transformations: aiResult.transformationSuggestions,
          insights: aiResult.insights,
          qualityScore: aiResult.overallQualityScore
        }
      }

      // Cache the result
      db.prepare(`
        INSERT INTO ai_schema_analysis (
          id, file_hash, original_schema, ai_enhanced_schema, ai_suggestions, confidence_score, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        `ai_${Date.now()}`,
        fileHash,
        JSON.stringify(columns),
        JSON.stringify(aiAnalysis.enhancedSchema),
        JSON.stringify(aiAnalysis.suggestions),
        aiAnalysis.suggestions.qualityScore,
        Date.now()
      )
    }

    // Analyze primary key candidates
    console.log('🔍 Analyzing primary key candidates...')
    const primaryKeyAnalysis = analyzePrimaryKeyCandidates(data, columns)

    return NextResponse.json({
      success: true,
      filepath,
      rowCount: data.length,
      columnCount: columns.length,
      columns,
      preview: data,
      aiAnalysis,
      primaryKeyAnalysis
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
