import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Map database row to API response format
 */
function mapTrigger(row: any) {
  return {
    id: row.id,
    workflowId: row.pipeline_id,
    triggerType: row.trigger_type,
    enabled: Boolean(row.enabled),
    triggerName: row.trigger_name,
    // Scheduled trigger fields
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    // Dependency trigger fields
    dependsOnWorkflowId: row.depends_on_pipeline_id,
    dependsOnWorkflowName: row.depends_on_workflow_name,
    dependencyCondition: row.dependency_condition,
    delayMinutes: row.delay_minutes,
    // Event trigger fields
    eventType: row.event_type,
    eventConfig: row.event_config ? JSON.parse(row.event_config) : undefined,
    // Timestamps
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * GET /api/workflows/:workflowId/triggers/:triggerId
 * Get a specific trigger
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
    const db = getDatabase()

    const trigger = db.prepare(`
      SELECT
        t.*,
        w.name as depends_on_workflow_name
      FROM pipeline_triggers t
      LEFT JOIN pipelines w ON t.depends_on_pipeline_id = w.id
      WHERE t.id = ? AND t.pipeline_id = ?
    `).get(triggerId, workflowId)

    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      trigger: mapTrigger(trigger)
    })
  } catch (error) {
    console.error('Error fetching trigger:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trigger' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/workflows/:workflowId/triggers/:triggerId
 * Update a trigger
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
    const body = await request.json()
    const db = getDatabase()

    // Check if trigger exists
    const existing = db.prepare(`
      SELECT * FROM pipeline_triggers WHERE id = ? AND pipeline_id = ?
    `).get(triggerId, workflowId)

    if (!existing) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const values: any[] = []

    if (body.triggerName !== undefined) {
      updates.push('trigger_name = ?')
      values.push(body.triggerName)
    }

    if (body.enabled !== undefined) {
      updates.push('enabled = ?')
      values.push(body.enabled ? 1 : 0)
    }

    // Scheduled trigger updates
    if (body.cronExpression !== undefined) {
      updates.push('cron_expression = ?')
      values.push(body.cronExpression)
    }

    if (body.timezone !== undefined) {
      updates.push('timezone = ?')
      values.push(body.timezone)
    }

    if (body.nextRunAt !== undefined) {
      updates.push('next_run_at = ?')
      values.push(body.nextRunAt)
    }

    // Dependency trigger updates
    if (body.dependsOnWorkflowId !== undefined) {
      // Validate upstream workflow exists
      const upstreamWorkflow = db.prepare(`
        SELECT id FROM pipelines WHERE id = ?
      `).get(body.dependsOnWorkflowId)

      if (!upstreamWorkflow) {
        return NextResponse.json(
          { error: 'Upstream workflow not found' },
          { status: 404 }
        )
      }

      // Check for self-dependency
      if (body.dependsOnWorkflowId === workflowId) {
        return NextResponse.json(
          { error: 'Workflow cannot depend on itself' },
          { status: 400 }
        )
      }

      updates.push('depends_on_pipeline_id = ?')
      values.push(body.dependsOnWorkflowId)
    }

    if (body.dependencyCondition !== undefined) {
      const validConditions = ['on_success', 'on_failure', 'on_completion']
      if (!validConditions.includes(body.dependencyCondition)) {
        return NextResponse.json(
          { error: `Invalid dependencyCondition. Must be one of: ${validConditions.join(', ')}` },
          { status: 400 }
        )
      }
      updates.push('dependency_condition = ?')
      values.push(body.dependencyCondition)
    }

    if (body.delayMinutes !== undefined) {
      updates.push('delay_minutes = ?')
      values.push(body.delayMinutes)
    }

    // Event trigger updates
    if (body.eventType !== undefined) {
      updates.push('event_type = ?')
      values.push(body.eventType)
    }

    if (body.eventConfig !== undefined) {
      updates.push('event_config = ?')
      values.push(body.eventConfig ? JSON.stringify(body.eventConfig) : null)
    }

    if (updates.length === 0) {
      // No updates, return existing trigger
      const trigger = db.prepare(`
        SELECT
          t.*,
          w.name as depends_on_workflow_name
        FROM pipeline_triggers t
        LEFT JOIN pipelines w ON t.depends_on_pipeline_id = w.id
        WHERE t.id = ?
      `).get(triggerId)

      return NextResponse.json({
        trigger: mapTrigger(trigger)
      })
    }

    // Add updated_at
    updates.push('updated_at = ?')
    values.push(Date.now())

    // Add WHERE clause values
    values.push(triggerId)
    values.push(workflowId)

    // Execute update
    db.prepare(`
      UPDATE pipeline_triggers
      SET ${updates.join(', ')}
      WHERE id = ? AND pipeline_id = ?
    `).run(...values)

    // Fetch updated trigger
    const trigger = db.prepare(`
      SELECT
        t.*,
        w.name as depends_on_workflow_name
      FROM pipeline_triggers t
      LEFT JOIN pipelines w ON t.depends_on_pipeline_id = w.id
      WHERE t.id = ?
    `).get(triggerId)

    console.log(`Updated trigger ${triggerId}`)

    return NextResponse.json({
      trigger: mapTrigger(trigger)
    })
  } catch (error) {
    console.error('Error updating trigger:', error)
    return NextResponse.json(
      { error: 'Failed to update trigger' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/:workflowId/triggers/:triggerId
 * Delete a trigger
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
    const db = getDatabase()

    const result = db.prepare(`
      DELETE FROM pipeline_triggers
      WHERE id = ? AND pipeline_id = ?
    `).run(triggerId, workflowId)

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    console.log(`Deleted trigger ${triggerId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting trigger:', error)
    return NextResponse.json(
      { error: 'Failed to delete trigger' },
      { status: 500 }
    )
  }
}
