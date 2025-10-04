import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { executeJob } from '@/lib/processing/job-executor'
import type { Job } from '@/types/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/jobs/[jobId]/execute
 * Execute a job (CSV → Bronze → Silver → Gold)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    const body = await request.json()
    const { sourceFilePath } = body

    if (!sourceFilePath) {
      return NextResponse.json(
        { error: 'sourceFilePath is required' },
        { status: 400 }
      )
    }

    console.log(`🚀 Executing job: ${jobId}`)

    // Get job from database
    const db = getDatabase()
    const jobRow = db.prepare(`
      SELECT * FROM jobs WHERE id = ?
    `).get(jobId) as any

    if (!jobRow) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Reconstruct job object
    const job: Job = {
      id: jobRow.id,
      workflowId: jobRow.workflow_id,
      name: jobRow.name,
      description: jobRow.description,
      type: jobRow.type,
      order: jobRow.order_index,
      status: jobRow.status,
      sourceConfig: JSON.parse(jobRow.source_config),
      destinationConfig: JSON.parse(jobRow.destination_config),
      transformationConfig: jobRow.transformation_config ? JSON.parse(jobRow.transformation_config) : undefined,
      validationConfig: jobRow.validation_config ? JSON.parse(jobRow.validation_config) : undefined,
      lastRun: jobRow.last_run ? new Date(jobRow.last_run) : undefined,
      createdAt: new Date(jobRow.created_at),
      updatedAt: new Date(jobRow.updated_at)
    }

    // Execute job
    const result = await executeJob(job, sourceFilePath)

    return NextResponse.json({
      success: result.success,
      executionId: result.executionId,
      bronzeRecords: result.bronzeRecords,
      silverRecords: result.silverRecords,
      goldRecords: result.goldRecords,
      bronzeFilePath: result.bronzeFilePath,
      silverFilePath: result.silverFilePath,
      goldFilePath: result.goldFilePath,
      logs: result.logs,
      error: result.error
    })

  } catch (error) {
    console.error('❌ Job execution error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Execution failed' },
      { status: 500 }
    )
  }
}
