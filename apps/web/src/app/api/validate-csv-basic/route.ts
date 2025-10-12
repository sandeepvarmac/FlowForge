import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface BasicValidationResult {
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
  }
  metadata: {
    fileName: string
    rowCount: number
    columnCount: number
    firstThreeRows: string[]
  }
  progress: number
  error?: string
}

/**
 * Step 1 of 3: Basic CSV validation (30% progress)
 * Validates file format, size, and checks if file is empty
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No file provided',
        progress: 0
      }, { status: 400 })
    }

    console.log('🔍 Step 1/3: Basic CSV validation for:', file.name)

    const result: BasicValidationResult = {
      success: true,
      validation: {
        fileFormat: { valid: false, message: '' },
        fileSize: { valid: false, sizeInMB: 0 },
        isEmpty: { valid: false }
      },
      metadata: {
        fileName: file.name,
        rowCount: 0,
        columnCount: 0,
        firstThreeRows: []
      },
      progress: 30
    }

    // 1. Validate file format (CSV only)
    const fileExtension = file.name.toLowerCase().split('.').pop()
    if (fileExtension !== 'csv') {
      result.validation.fileFormat = {
        valid: false,
        message: `Invalid file format: .${fileExtension}. Please upload a CSV file.`
      }
      result.success = false
      result.progress = 0
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
      result.progress = 0
      return NextResponse.json(result)
    }

    if (lines.length === 1) {
      result.validation.isEmpty = {
        valid: false,
        message: 'CSV file contains only one row. Please upload a file with at least a header and one data row.'
      }
      result.success = false
      result.progress = 0
      return NextResponse.json(result)
    }

    result.validation.isEmpty = {
      valid: true,
      message: `File contains ${lines.length} rows`
    }

    // 4. Extract metadata for next steps
    const firstThreeRows = lines.slice(0, 3)
    const columnCount = firstThreeRows[0].split(',').length

    result.metadata = {
      fileName: file.name,
      rowCount: lines.length,
      columnCount,
      firstThreeRows
    }

    console.log('✅ Step 1/3 complete: Basic validation passed (30%)', {
      rows: result.metadata.rowCount,
      columns: result.metadata.columnCount
    })

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ Basic CSV validation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Validation failed',
        progress: 0
      },
      { status: 500 }
    )
  }
}
