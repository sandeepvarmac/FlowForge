import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Workflow, WorkflowFormData } from '@/types/workflow'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows
 * Get all workflows
 */
export async function GET() {
  try {
    const db = getDatabase()

    const workflows = db.prepare(`
      SELECT w.*,
        (SELECT json_group_array(
          json_object(
            'id', j.id,
            'workflowId', j.workflow_id,
            'name', j.name,
            'description', j.description,
            'type', j.type,
            'order', j.order_index,
            'status', j.status,
            'sourceConfig', json(j.source_config),
            'destinationConfig', json(j.destination_config),
            'transformationConfig', json(j.transformation_config),
            'validationConfig', json(j.validation_config),
            'lastRun', j.last_run,
            'createdAt', j.created_at,
            'updatedAt', j.updated_at
          )
        ) FROM jobs j WHERE j.workflow_id = w.id ORDER BY j.order_index) as jobs
      FROM workflows w
      ORDER BY w.created_at DESC
    `).all() as any[]

    const result = workflows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      application: row.application,
      owner: row.owner,
      status: row.status,
      type: row.type,
      businessUnit: row.business_unit,
      notificationEmail: row.notification_email,
      tags: row.tags ? JSON.parse(row.tags) : [],
      jobs: row.jobs ? JSON.parse(row.jobs) : [],
      lastRun: row.last_run ? new Date(row.last_run) : undefined,
      nextRun: row.next_run ? new Date(row.next_run) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }))

    return NextResponse.json({ workflows: result })

  } catch (error) {
    console.error('❌ Error fetching workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch workflows' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows
 * Create a new workflow
 */
export async function POST(request: NextRequest) {
  try {
    const body: WorkflowFormData = await request.json()
    const db = getDatabase()

    const now = Date.now()
    const id = `wf_${now}_${Math.random().toString(36).substring(7)}`

    db.prepare(`
      INSERT INTO workflows (
        id, name, description, application, owner, status, type,
        business_unit, notification_email, tags,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.description,
      body.application,
      body.team,
      body.workflowType === 'manual' ? 'manual' : 'scheduled',
      body.workflowType,
      body.businessUnit,
      body.notificationEmail,
      JSON.stringify(body.tags || []),
      now,
      now
    )

    const workflow: Workflow = {
      id,
      name: body.name,
      description: body.description,
      application: body.application,
      owner: body.team,
      status: body.workflowType === 'manual' ? 'manual' : 'scheduled',
      type: body.workflowType,
      businessUnit: body.businessUnit,
      notificationEmail: body.notificationEmail,
      tags: body.tags || [],
      jobs: [],
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }

    console.log(`✅ Created workflow: ${workflow.name} (${id})`)

    return NextResponse.json({ workflow })

  } catch (error) {
    console.error('❌ Error creating workflow:', error)
    return NextResponse.json(
      { error: 'Failed to create workflow' },
      { status: 500 }
    )
  }
}
