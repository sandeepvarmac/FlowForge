import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/:workflowId/landing-files
 * List all files in the landing folder for a workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      )
    }

    console.log(`📂 Listing landing files for workflow: ${workflowId}`)

    // List all files in the landing folder for this workflow
    const prefix = `landing/${workflowId}/`
    const files = await listFiles(prefix)

    console.log(`✅ Found ${files.length} files in landing folder`)

    // Group files by job
    const filesByJob: Record<string, any[]> = {}

    files.forEach(file => {
      // Extract job ID from path: landing/workflowId/jobId/filename
      const parts = file.key.split('/')
      if (parts.length >= 4) {
        const jobId = parts[2]
        const filename = parts.slice(3).join('/') // Handle nested paths

        if (!filesByJob[jobId]) {
          filesByJob[jobId] = []
        }

        filesByJob[jobId].push({
          filename,
          fullPath: file.key,
          size: file.size,
          lastModified: file.lastModified,
          s3Path: `s3://flowforge-data/${file.key}`
        })
      }
    })

    return NextResponse.json({
      success: true,
      workflowId,
      totalFiles: files.length,
      filesByJob
    })

  } catch (error) {
    console.error('❌ Error listing landing files:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list landing files' },
      { status: 500 }
    )
  }
}
