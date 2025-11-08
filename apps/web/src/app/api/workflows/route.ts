import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Workflow, WorkflowFormData } from '@/types/workflow'
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
 * GET /api/workflows
 * Get all workflows
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const includeLastExecution = searchParams.get('includeLastExecution') === 'true'

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
        ) FROM jobs j WHERE j.workflow_id = w.id ORDER BY j.order_index) as jobs,
        (SELECT json_group_array(
          json_object(
            'id', t.id,
            'triggerType', t.trigger_type,
            'enabled', t.enabled,
            'cronExpression', t.cron_expression,
            'nextRunAt', t.next_run_at,
            'dependsOnWorkflowId', t.depends_on_workflow_id,
            'dependencyCondition', t.dependency_condition
          )
        ) FROM workflow_triggers t WHERE t.workflow_id = w.id AND t.enabled = 1) as triggers
      FROM workflows w
      ORDER BY w.created_at DESC
    `).all() as any[]

    const result = workflows.map(row => {
      const triggers = row.triggers ? JSON.parse(row.triggers) : []

      // Calculate dynamic status based on enabled triggers
      let calculatedStatus = 'manual'
      let calculatedType = 'manual'
      let nextRunTimestamp: number | null = null

      if (triggers.length > 0) {
        // Priority: scheduled > dependency > manual
        const hasScheduled = triggers.some((t: any) => t.triggerType === 'scheduled')
        const hasDependency = triggers.some((t: any) => t.triggerType === 'dependency')

        if (hasScheduled) {
          calculatedStatus = 'scheduled'
          calculatedType = 'scheduled'

          // Find earliest next run time from scheduled triggers
          const scheduledTriggers = triggers.filter((t: any) => t.triggerType === 'scheduled' && t.nextRunAt)
          if (scheduledTriggers.length > 0) {
            const nextRuns = scheduledTriggers.map((t: any) => {
              const now = Math.floor(Date.now() / 1000)
              // If next run is in the past, recalculate
              if (t.nextRunAt < now && t.cronExpression) {
                const recalculated = calculateNextRun(t.cronExpression, t.timezone || 'UTC')
                if (recalculated) {
                  // Update the database with the new next_run_at
                  try {
                    db.prepare('UPDATE workflow_triggers SET next_run_at = ? WHERE id = ?')
                      .run(recalculated, t.id)
                  } catch (error) {
                    console.error('Failed to update next_run_at:', error)
                  }
                  return recalculated
                }
              }
              return t.nextRunAt
            })
            nextRunTimestamp = Math.min(...nextRuns)
          }
        } else if (hasDependency) {
          calculatedStatus = 'dependency'
          calculatedType = 'event-driven'
        }
      }

      const workflow: any = {
        id: row.id,
        name: row.name,
        description: row.description,
        application: row.application,
        owner: row.owner,
        status: calculatedStatus, // Use calculated status instead of stored status
        type: calculatedType, // Use calculated type instead of stored type
        team: row.team,
        environment: row.environment,
        priority: row.priority,
        dataClassification: row.data_classification,
        notificationEmail: row.notification_email,
        tags: row.tags ? JSON.parse(row.tags) : [],
        jobs: row.jobs ? JSON.parse(row.jobs) : [],
        lastRun: row.last_run ? new Date(row.last_run) : undefined,
        nextRun: nextRunTimestamp ? new Date(nextRunTimestamp * 1000) : undefined,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }

      // Include last execution if requested
      if (includeLastExecution) {
        const lastExecution = db.prepare(`
          SELECT
            e.*,
            (SELECT COUNT(*) FROM job_executions je WHERE je.execution_id = e.id AND je.status = 'completed') as completed_jobs,
            (SELECT COUNT(*) FROM job_executions je WHERE je.execution_id = e.id AND je.status = 'failed') as failed_jobs,
            (SELECT COUNT(*) FROM job_executions je WHERE je.execution_id = e.id) as total_jobs
          FROM executions e
          WHERE e.workflow_id = ?
          ORDER BY e.created_at DESC
          LIMIT 1
        `).get(row.id) as any

        if (lastExecution) {
          workflow.lastExecution = {
            id: lastExecution.id,
            status: lastExecution.status,
            startTime: lastExecution.started_at,
            endTime: lastExecution.completed_at,
            duration: lastExecution.duration_ms,
            completedJobs: lastExecution.completed_jobs,
            failedJobs: lastExecution.failed_jobs,
            totalJobs: lastExecution.total_jobs,
          }
        } else {
          workflow.lastExecution = null
        }
      }

      return workflow
    })

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
        team, notification_email, tags, environment, priority, data_classification,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.name,
      body.description,
      body.application,
      body.team,
      body.workflowType === 'manual' ? 'manual' : 'scheduled',
      body.workflowType,
      body.team, // Using team instead of businessUnit
      body.notificationEmail,
      JSON.stringify(body.tags || []),
      body.environment || 'development',
      body.priority || null,
      body.dataClassification || null,
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
      team: body.team,
      environment: body.environment || 'development',
      priority: body.priority,
      dataClassification: body.dataClassification,
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
