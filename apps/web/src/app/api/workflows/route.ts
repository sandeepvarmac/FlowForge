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
 * Get all workflows (pipelines)
 *
 * Note: This endpoint uses the new table names (pipelines, sources, pipeline_triggers)
 * but returns data with legacy field names (workflows, jobs) for backward compatibility
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const includeLastExecution = searchParams.get('includeLastExecution') === 'true'

    // Use new table names: pipelines (was workflows), sources (was jobs), pipeline_triggers (was workflow_triggers)
    const workflows = db.prepare(`
      SELECT p.*,
        (SELECT json_group_array(
          json_object(
            'id', s.id,
            'workflowId', s.pipeline_id,
            'name', s.name,
            'description', s.description,
            'type', s.type,
            'order', s.order_index,
            'status', s.status,
            'sourceConfig', json(s.source_config),
            'destinationConfig', json(s.destination_config),
            'transformationConfig', json(s.transformation_config),
            'validationConfig', json(s.validation_config),
            'lastRun', s.last_run,
            'createdAt', s.created_at,
            'updatedAt', s.updated_at
          )
        ) FROM sources s WHERE s.pipeline_id = p.id ORDER BY s.order_index) as jobs,
        (SELECT json_group_array(
          json_object(
            'id', t.id,
            'triggerType', t.trigger_type,
            'enabled', t.enabled,
            'cronExpression', t.cron_expression,
            'nextRunAt', t.next_run_at,
            'dependsOnWorkflowId', t.depends_on_pipeline_id,
            'dependencyCondition', t.dependency_condition
          )
        ) FROM pipeline_triggers t WHERE t.pipeline_id = p.id AND t.enabled = 1) as triggers
      FROM pipelines p
      ORDER BY p.created_at DESC
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
                    db.prepare('UPDATE pipeline_triggers SET next_run_at = ? WHERE id = ?')
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
        pipelineMode: row.pipeline_mode || 'source-centric',
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at)
      }

      // Include last execution if requested
      if (includeLastExecution) {
        const lastExecution = db.prepare(`
          SELECT
            e.*,
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'completed') as completed_jobs,
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'failed') as failed_jobs,
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id) as total_jobs
          FROM executions e
          WHERE e.pipeline_id = ?
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
 * Create a new workflow (pipeline)
 */
export async function POST(request: NextRequest) {
  try {
    const body: WorkflowFormData = await request.json()
    const db = getDatabase()

    const now = Date.now()
    // Use 'pl_' prefix for new pipelines
    const id = `pl_${now}_${Math.random().toString(36).substring(7)}`

    // Insert into pipelines table (was workflows)
    db.prepare(`
      INSERT INTO pipelines (
        id, name, description, application, owner, status, type,
        team, notification_email, tags, environment, priority, data_classification,
        pipeline_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      body.pipelineMode || 'source-centric', // Default to source-centric
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

    console.log(`✅ Created pipeline: ${workflow.name} (${id})`)

    return NextResponse.json({ workflow })

  } catch (error) {
    console.error('❌ Error creating pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to create pipeline' },
      { status: 500 }
    )
  }
}
