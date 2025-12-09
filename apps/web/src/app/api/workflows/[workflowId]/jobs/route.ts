import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Job } from '@/types/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflows/[workflowId]/jobs
 * Create a new job in a workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const body = await request.json()

    const db = getDatabase()
    const now = Date.now()
    const id = `job_${now}_${Math.random().toString(36).substring(7)}`

    db.prepare(`
      INSERT INTO sources (
        id, pipeline_id, name, description, type, order_index, status,
        source_config, destination_config, transformation_config, validation_config,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workflowId,
      body.name,
      body.description || '',
      body.type,
      body.order || 1,
      'configured',
      JSON.stringify(body.sourceConfig),
      JSON.stringify(body.destinationConfig),
      body.transformationConfig ? JSON.stringify(body.transformationConfig) : null,
      body.validationConfig ? JSON.stringify(body.validationConfig) : null,
      now,
      now
    )

    const job: Job = {
      id,
      workflowId,
      name: body.name,
      description: body.description,
      type: body.type,
      order: body.order || 1,
      status: 'configured',
      sourceConfig: body.sourceConfig,
      destinationConfig: body.destinationConfig,
      transformationConfig: body.transformationConfig,
      validationConfig: body.validationConfig,
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }

    console.log(`✅ Created job: ${job.name} (${id}) in workflow ${workflowId}`)

    return NextResponse.json({ job })

  } catch (error) {
    console.error('❌ Error creating job:', error)
    return NextResponse.json(
      { error: 'Failed to create job' },
      { status: 500 }
    )
  }
}
