import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function mapWorkflow(row: any, jobs: any[]) {
  return {
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
    jobs,
    lastRun: row.last_run ? new Date(row.last_run) : undefined,
    nextRun: row.next_run ? new Date(row.next_run) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at)
  }
}

function loadJobs(db: any, workflowId: string) {
  const rows = db.prepare(`
    SELECT * FROM jobs
    WHERE workflow_id = ?
    ORDER BY order_index ASC
  `).all(workflowId) as any[]

  return rows.map(row => ({
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
  }))
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  const { workflowId } = params
  const db = getDatabase()

  const workflow = db.prepare(`
    SELECT * FROM workflows WHERE id = ?
  `).get(workflowId)

  if (!workflow) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  const jobs = loadJobs(db, workflowId)

  return NextResponse.json({ workflow: mapWorkflow(workflow, jobs) })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  const { workflowId } = params
  const updates = await request.json()
  const db = getDatabase()

  const existing = db.prepare(`
    SELECT * FROM workflows WHERE id = ?
  `).get(workflowId)

  if (!existing) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  const columnMap: Record<string, string> = {
    name: 'name',
    description: 'description',
    application: 'application',
    owner: 'owner',
    status: 'status',
    type: 'type',
    businessUnit: 'business_unit',
    notificationEmail: 'notification_email',
    tags: 'tags',
    lastRun: 'last_run',
    nextRun: 'next_run'
  }

  const setClauses: string[] = []
  const values: any[] = []

  Object.entries(updates).forEach(([key, value]) => {
    const column = columnMap[key]
    if (!column) return

    if (key === 'tags') {
      setClauses.push(`${column} = ?`)
      values.push(JSON.stringify(value ?? []))
      return
    }

    if (key === 'lastRun' || key === 'nextRun') {
      const timestamp = value ? new Date(value).getTime() : null
      setClauses.push(`${column} = ?`)
      values.push(timestamp)
      return
    }

    setClauses.push(`${column} = ?`)
    values.push(value)
  })

  if (setClauses.length === 0) {
    return NextResponse.json({ workflow: mapWorkflow(existing, loadJobs(db, workflowId)) })
  }

  setClauses.push('updated_at = ?')
  values.push(Date.now())
  values.push(workflowId)

  db.prepare(`
    UPDATE workflows
    SET ${setClauses.join(', ')}
    WHERE id = ?
  `).run(...values)

  const updated = db.prepare(`
    SELECT * FROM workflows WHERE id = ?
  `).get(workflowId)
  const jobs = loadJobs(db, workflowId)

  return NextResponse.json({ workflow: mapWorkflow(updated, jobs) })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  const { workflowId } = params
  const db = getDatabase()

  const result = db.prepare(`
    DELETE FROM workflows WHERE id = ?
  `).run(workflowId)

  if (result.changes === 0) {
    return NextResponse.json(
      { error: 'Workflow not found' },
      { status: 404 }
    )
  }

  return NextResponse.json({ success: true })
}
