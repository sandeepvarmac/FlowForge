import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Job } from '@/types/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflows/[workflowId]/jobs/[jobId]/clone
 * Clone an existing job with "_copy" suffix
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string; jobId: string } }
) {
  try {
    const { workflowId, jobId } = params

    const db = getDatabase()

    // Fetch the original job
    const originalRow = db.prepare(`
      SELECT * FROM sources
      WHERE id = ? AND pipeline_id = ?
    `).get(jobId, workflowId) as any

    if (!originalRow) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    // Get the highest order in the workflow
    const maxOrderRow = db.prepare(`
      SELECT MAX(order_index) as max_order FROM sources
      WHERE pipeline_id = ?
    `).get(workflowId) as any

    const newOrder = (maxOrderRow?.max_order || 0) + 1

    // Generate new job ID
    const now = Date.now()
    const newJobId = `job_${now}_${Math.random().toString(36).substring(7)}`

    // Find a unique name with "_copy" suffix
    let clonedName = `${originalRow.name}_copy`
    let copyNumber = 1
    while (true) {
      const existingJob = db.prepare(`
        SELECT id FROM sources
        WHERE pipeline_id = ? AND name = ?
      `).get(workflowId, clonedName)

      if (!existingJob) break
      copyNumber++
      clonedName = `${originalRow.name}_copy${copyNumber}`
    }

    // Insert cloned job
    db.prepare(`
      INSERT INTO sources (
        id, pipeline_id, name, description, type, order_index, status,
        source_config, destination_config, transformation_config, validation_config,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newJobId,
      workflowId,
      clonedName,
      originalRow.description ? `${originalRow.description} (cloned)` : 'Cloned job',
      originalRow.type,
      newOrder,
      'configured',
      originalRow.source_config,
      originalRow.destination_config,
      originalRow.transformation_config,
      originalRow.validation_config,
      now,
      now
    )

    // Fetch the newly created job
    const newRow = db.prepare(`
      SELECT * FROM sources
      WHERE id = ?
    `).get(newJobId) as any

    const clonedJob: Job = {
      id: newRow.id,
      workflowId: newRow.pipeline_id,
      name: newRow.name,
      description: newRow.description,
      type: newRow.type,
      order: newRow.order_index,
      status: newRow.status,
      sourceConfig: JSON.parse(newRow.source_config),
      destinationConfig: JSON.parse(newRow.destination_config),
      transformationConfig: newRow.transformation_config ? JSON.parse(newRow.transformation_config) : undefined,
      validationConfig: newRow.validation_config ? JSON.parse(newRow.validation_config) : undefined,
      createdAt: new Date(newRow.created_at),
      updatedAt: new Date(newRow.updated_at)
    }

    console.log(`✅ Cloned job: ${originalRow.name} → ${clonedName} (${newJobId})`)

    return NextResponse.json({ job: clonedJob })

  } catch (error) {
    console.error('❌ Error cloning job:', error)
    return NextResponse.json(
      { error: 'Failed to clone job' },
      { status: 500 }
    )
  }
}
