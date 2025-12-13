import { NextRequest, NextResponse } from 'next/server'
import { listFiles } from '@/lib/storage'
import { getDb } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/:workflowId/landing-files
 * List all files in the landing folder for a workflow
 *
 * New path pattern: landing/{source_name}/{yyyy/MM/dd}/{timestamp}_{filename}
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params

    if (!workflowId) {
      return NextResponse.json(
        { error: 'workflowId is required' },
        { status: 400 }
      )
    }

    console.log(`📂 Listing landing files for workflow: ${workflowId}`)

    // Get all sources (jobs) for this workflow to find their source names
    const db = getDb()
    const jobs = db.prepare(`
      SELECT id, name FROM sources WHERE pipeline_id = ?
    `).all(workflowId) as { id: string; name: string }[]

    const allFiles: any[] = []
    const filesByJob: Record<string, any[]> = {}

    // For each source, look for files in landing/{source_name}/
    for (const job of jobs) {
      const sourceName = job.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
      const prefix = `landing/${sourceName}/`

      console.log(`  Looking for files with prefix: ${prefix}`)

      try {
        const files = await listFiles(prefix)

        if (files.length > 0) {
          filesByJob[job.id] = []

          files.forEach(file => {
            // Extract filename from path: landing/source_name/yyyy/MM/dd/timestamp_filename
            const parts = file.key.split('/')
            const filename = parts[parts.length - 1]
            // Remove timestamp prefix if present (e.g., "1733840000000_file.csv" -> "file.csv")
            const displayName = filename.replace(/^\d+_/, '')

            const fileInfo = {
              filename: displayName,
              fullPath: file.key,
              size: file.size,
              lastModified: file.lastModified,
              s3Path: `s3://flowforge-data/${file.key}`,
              sourceName: job.name
            }

            filesByJob[job.id].push(fileInfo)
            allFiles.push(fileInfo)
          })
        }
      } catch (err) {
        console.log(`  No files found for source: ${sourceName}`)
      }
    }

    // Also check for legacy files with old path pattern (landing/workflowId/jobId/)
    try {
      const legacyPrefix = `landing/${workflowId}/`
      const legacyFiles = await listFiles(legacyPrefix)

      legacyFiles.forEach(file => {
        const parts = file.key.split('/')
        if (parts.length >= 4) {
          const jobId = parts[2]
          const filename = parts.slice(3).join('/')

          if (!filesByJob[jobId]) {
            filesByJob[jobId] = []
          }

          const fileInfo = {
            filename,
            fullPath: file.key,
            size: file.size,
            lastModified: file.lastModified,
            s3Path: `s3://flowforge-data/${file.key}`,
            legacy: true
          }

          filesByJob[jobId].push(fileInfo)
          allFiles.push(fileInfo)
        }
      })
    } catch (err) {
      // No legacy files, that's fine
    }

    console.log(`✅ Found ${allFiles.length} total files in landing folder`)

    return NextResponse.json({
      success: true,
      workflowId,
      totalFiles: allFiles.length,
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
