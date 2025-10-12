import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Job } from '@/types/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/[workflowId]/jobs/[jobId]
 * Get a single job by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string; jobId: string } }
) {
  try {
    const { workflowId, jobId } = params

    const db = getDatabase()
    const row = db.prepare(`
      SELECT * FROM jobs
      WHERE id = ? AND workflow_id = ?
    `).get(jobId, workflowId) as any

    if (!row) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const job: Job = {
      id: row.id,
      workflowId: row.workflow_id,
      name: row.name,
      description: row.description,
      type: row.type,
      order: row.order_index,
      status: row.status,
      sourceConfig: JSON.parse(row.source_config),
      destinationConfig: JSON.parse(row.destination_config),
      transformationConfig: row.transformation_config ? JSON.parse(row.transformation_config) : undefined,
      validationConfig: row.validation_config ? JSON.parse(row.validation_config) : undefined,
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }

    return NextResponse.json({ job })

  } catch (error) {
    console.error('❌ Error fetching job:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/workflows/[workflowId]/jobs/[jobId]
 * Update an existing job
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { workflowId: string; jobId: string } }
) {
  try {
    const { workflowId, jobId } = params
    const body = await request.json()

    const db = getDatabase()

    // Check if job exists
    const existing = db.prepare(`
      SELECT id FROM jobs
      WHERE id = ? AND workflow_id = ?
    `).get(jobId, workflowId)

    if (!existing) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    const now = Date.now()

    // Update job
    db.prepare(`
      UPDATE jobs SET
        name = ?,
        description = ?,
        type = ?,
        order_index = ?,
        source_config = ?,
        destination_config = ?,
        transformation_config = ?,
        validation_config = ?,
        updated_at = ?
      WHERE id = ? AND workflow_id = ?
    `).run(
      body.name,
      body.description || '',
      body.type,
      body.order || 1,
      JSON.stringify(body.sourceConfig),
      JSON.stringify(body.destinationConfig),
      body.transformationConfig ? JSON.stringify(body.transformationConfig) : null,
      body.validationConfig ? JSON.stringify(body.validationConfig) : null,
      now,
      jobId,
      workflowId
    )

    // Fetch updated job
    const row = db.prepare(`
      SELECT * FROM jobs
      WHERE id = ? AND workflow_id = ?
    `).get(jobId, workflowId) as any

    const job: Job = {
      id: row.id,
      workflowId: row.workflow_id,
      name: row.name,
      description: row.description,
      type: row.type,
      order: row.order_index,
      status: row.status,
      sourceConfig: JSON.parse(row.source_config),
      destinationConfig: JSON.parse(row.destination_config),
      transformationConfig: row.transformation_config ? JSON.parse(row.transformation_config) : undefined,
      validationConfig: row.validation_config ? JSON.parse(row.validation_config) : undefined,
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }

    console.log(`✅ Updated job: ${job.name} (${jobId}) in workflow ${workflowId}`)

    return NextResponse.json({ job })

  } catch (error) {
    console.error('❌ Error updating job:', error)
    return NextResponse.json(
      { error: 'Failed to update job' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/[workflowId]/jobs/[jobId]
 * Delete a job
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workflowId: string; jobId: string } }
) {
  try {
    const { workflowId, jobId } = params

    const db = getDatabase()

    // Check if job exists
    const existing = db.prepare(`
      SELECT id FROM jobs
      WHERE id = ? AND workflow_id = ?
    `).get(jobId, workflowId)

    if (!existing) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Delete job
    db.prepare(`
      DELETE FROM jobs
      WHERE id = ? AND workflow_id = ?
    `).run(jobId, workflowId)

    console.log(`✅ Deleted job ${jobId} from workflow ${workflowId}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('❌ Error deleting job:', error)
    return NextResponse.json(
      { error: 'Failed to delete job' },
      { status: 500 }
    )
  }
}
