import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { randomUUID } from 'crypto'
import { Cron } from 'croner'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Calculate next run time from cron expression
 * Returns Unix timestamp (seconds) or null if invalid
 */
function calculateNextRun(cronExpression: string, timezone: string = 'UTC'): number | null {
  try {
    const cron = new Cron(cronExpression, { timezone })
    const nextRun = cron.nextRun()
    cron.stop() // Clean up
    if (!nextRun) return null
    return Math.floor(nextRun.getTime() / 1000) // Convert to Unix timestamp (seconds)
  } catch (error) {
    console.error('Error parsing cron expression:', error)
    return null
  }
}

/**
 * Map database row to API response format
 */
function mapTrigger(row: any) {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    triggerType: row.trigger_type,
    enabled: Boolean(row.enabled),
    triggerName: row.trigger_name,
    // Scheduled trigger fields
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    // Dependency trigger fields
    dependsOnWorkflowId: row.depends_on_workflow_id,
    dependsOnWorkflowName: row.depends_on_workflow_name, // Populated by JOIN
    dependencyCondition: row.dependency_condition,
    delayMinutes: row.delay_minutes,
    // Event trigger fields
    eventType: row.event_type,
    eventConfig: row.event_config ? JSON.parse(row.event_config) : undefined,
    // Timestamps (Unix timestamps from DB)
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * GET /api/workflows/:workflowId/triggers
 * List all triggers for a workflow
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    // Check if workflow exists
    const workflow = db.prepare(`
      SELECT id FROM workflows WHERE id = ?
    `).get(workflowId)

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Get all triggers for this workflow with workflow names for dependencies
    const triggers = db.prepare(`
      SELECT
        t.*,
        w.name as depends_on_workflow_name
      FROM workflow_triggers t
      LEFT JOIN workflows w ON t.depends_on_workflow_id = w.id
      WHERE t.workflow_id = ?
      ORDER BY t.created_at DESC
    `).all(workflowId) as any[]

    return NextResponse.json({
      triggers: triggers.map(mapTrigger)
    })
  } catch (error) {
    console.error('Error fetching triggers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch triggers' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/workflows/:workflowId/triggers
 * Create a new trigger
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const body = await request.json()
    const db = getDatabase()

    // Check if workflow exists
    const workflow = db.prepare(`
      SELECT id FROM workflows WHERE id = ?
    `).get(workflowId)

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Validate required fields based on trigger type
    if (!body.triggerType) {
      return NextResponse.json(
        { error: 'triggerType is required' },
        { status: 400 }
      )
    }

    // Validate trigger type
    const validTriggerTypes = ['manual', 'scheduled', 'dependency', 'event']
    if (!validTriggerTypes.includes(body.triggerType)) {
      return NextResponse.json(
        { error: `Invalid triggerType. Must be one of: ${validTriggerTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate scheduled trigger fields
    if (body.triggerType === 'scheduled') {
      if (!body.cronExpression) {
        return NextResponse.json(
          { error: 'cronExpression is required for scheduled triggers' },
          { status: 400 }
        )
      }
      // TODO: Add cron expression validation
    }

    // Validate dependency trigger fields
    if (body.triggerType === 'dependency') {
      if (!body.dependsOnWorkflowId) {
        return NextResponse.json(
          { error: 'dependsOnWorkflowId is required for dependency triggers' },
          { status: 400 }
        )
      }

      if (!body.dependencyCondition) {
        return NextResponse.json(
          { error: 'dependencyCondition is required for dependency triggers' },
          { status: 400 }
        )
      }

      // Validate dependency condition
      const validConditions = ['on_success', 'on_failure', 'on_completion']
      if (!validConditions.includes(body.dependencyCondition)) {
        return NextResponse.json(
          { error: `Invalid dependencyCondition. Must be one of: ${validConditions.join(', ')}` },
          { status: 400 }
        )
      }

      // Check if upstream workflow exists
      const upstreamWorkflow = db.prepare(`
        SELECT id FROM workflows WHERE id = ?
      `).get(body.dependsOnWorkflowId)

      if (!upstreamWorkflow) {
        return NextResponse.json(
          { error: 'Upstream workflow not found' },
          { status: 404 }
        )
      }

      // Check for circular dependencies (basic check)
      if (body.dependsOnWorkflowId === workflowId) {
        return NextResponse.json(
          { error: 'Workflow cannot depend on itself' },
          { status: 400 }
        )
      }

      // TODO: Implement full circular dependency detection
    }

    // Create trigger
    const triggerId = randomUUID()
    const now = Date.now()

    // Calculate next_run_at for scheduled triggers
    let nextRunAt = null
    if (body.triggerType === 'scheduled' && body.cronExpression) {
      const timezone = body.timezone || 'UTC'
      nextRunAt = calculateNextRun(body.cronExpression, timezone)

      if (nextRunAt === null) {
        return NextResponse.json(
          { error: 'Invalid cron expression. Please check the format.' },
          { status: 400 }
        )
      }
    }

    db.prepare(`
      INSERT INTO workflow_triggers (
        id, workflow_id, trigger_type, enabled, trigger_name,
        cron_expression, timezone, next_run_at, last_run_at,
        depends_on_workflow_id, dependency_condition, delay_minutes,
        event_type, event_config,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      triggerId,
      workflowId,
      body.triggerType,
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
      body.triggerName || null,
      body.cronExpression || null,
      body.timezone || 'UTC',
      nextRunAt,
      null, // last_run_at
      body.dependsOnWorkflowId || null,
      body.dependencyCondition || null,
      body.delayMinutes !== undefined ? body.delayMinutes : 0,
      body.eventType || null,
      body.eventConfig ? JSON.stringify(body.eventConfig) : null,
      now,
      now
    )

    // Fetch the created trigger with workflow name
    const trigger = db.prepare(`
      SELECT
        t.*,
        w.name as depends_on_workflow_name
      FROM workflow_triggers t
      LEFT JOIN workflows w ON t.depends_on_workflow_id = w.id
      WHERE t.id = ?
    `).get(triggerId)

    console.log(`Created ${body.triggerType} trigger ${triggerId} for workflow ${workflowId}`)

    return NextResponse.json({
      trigger: mapTrigger(trigger)
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating trigger:', error)
    return NextResponse.json(
      { error: 'Failed to create trigger' },
      { status: 500 }
    )
  }
}
