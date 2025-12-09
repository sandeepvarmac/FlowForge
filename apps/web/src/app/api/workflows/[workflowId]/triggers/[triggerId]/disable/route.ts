import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
    cronExpression: row.cron_expression,
    timezone: row.timezone,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    dependsOnWorkflowId: row.depends_on_workflow_id,
    dependsOnWorkflowName: row.depends_on_workflow_name,
    dependencyCondition: row.dependency_condition,
    delayMinutes: row.delay_minutes,
    eventType: row.event_type,
    eventConfig: row.event_config ? JSON.parse(row.event_config) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

/**
 * PATCH /api/workflows/:workflowId/triggers/:triggerId/disable
 * Disable a trigger
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
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

    // Disable the trigger
    db.prepare(`
      UPDATE pipeline_triggers
      SET enabled = 0, updated_at = ?
      WHERE id = ? AND pipeline_id = ?
    `).run(Date.now(), triggerId, workflowId)

    // Fetch updated trigger
    const trigger = db.prepare(`
      SELECT
        t.*,
        w.name as depends_on_workflow_name,
        wf.name as workflow_name
      FROM pipeline_triggers t
      LEFT JOIN pipelines w ON t.depends_on_pipeline_id = w.id
      JOIN pipelines wf ON t.pipeline_id = wf.id
      WHERE t.id = ?
    `).get(triggerId) as any

    console.log(`Disabled trigger ${triggerId}`)

    // For scheduled triggers, sync with Prefect (pause deployment)
    if (trigger.trigger_type === 'scheduled' && trigger.cron_expression) {
      try {
        const scriptPath = path.join(process.cwd(), '..', '..', 'prefect-flows', 'scripts', 'sync_deployment.py')
        const pythonExecutable = process.env.PYTHON_PATH || 'python'

        // Pause the deployment
        await execFileAsync(
          pythonExecutable,
          [scriptPath, 'pause', triggerId],
          { timeout: 15000 }
        )

        console.log(`Paused Prefect deployment for trigger ${triggerId}`)
      } catch (error) {
        // Log but don't fail the request if Prefect sync fails
        console.error('Failed to sync with Prefect (non-fatal):', error)
      }
    }

    return NextResponse.json({
      trigger: mapTrigger(trigger)
    })
  } catch (error) {
    console.error('Error disabling trigger:', error)
    return NextResponse.json(
      { error: 'Failed to disable trigger' },
      { status: 500 }
    )
  }
}
