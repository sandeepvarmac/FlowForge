import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import type { Pipeline, PipelineFormData } from '@/types/pipeline'
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
 * GET /api/pipelines
 * Get all pipelines (formerly workflows)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDatabase()
    const { searchParams } = new URL(request.url)
    const includeLastExecution = searchParams.get('includeLastExecution') === 'true'

    const pipelines = db.prepare(`
      SELECT p.*,
        (SELECT json_group_array(
          json_object(
            'id', s.id,
            'pipelineId', s.pipeline_id,
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
        ) FROM sources s WHERE s.pipeline_id = p.id ORDER BY s.order_index) as sources,
        (SELECT json_group_array(
          json_object(
            'id', t.id,
            'triggerType', t.trigger_type,
            'enabled', t.enabled,
            'cronExpression', t.cron_expression,
            'nextRunAt', t.next_run_at,
            'dependsOnPipelineId', t.depends_on_pipeline_id,
            'dependencyCondition', t.dependency_condition
          )
        ) FROM pipeline_triggers t WHERE t.pipeline_id = p.id AND t.enabled = 1) as triggers
      FROM pipelines p
      ORDER BY p.created_at DESC
    `).all() as any[]

    const result = pipelines.map(row => {
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

      const pipeline: any = {
        id: row.id,
        name: row.name,
        description: row.description,
        application: row.application,
        owner: row.owner,
        status: calculatedStatus,
        type: calculatedType,
        team: row.team,
        environment: row.environment,
        priority: row.priority,
        dataClassification: row.data_classification,
        notificationEmail: row.notification_email,
        tags: row.tags ? JSON.parse(row.tags) : [],
        sources: row.sources ? JSON.parse(row.sources) : [],
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
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'completed') as completed_sources,
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'failed') as failed_sources,
            (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id) as total_sources
          FROM executions e
          WHERE e.pipeline_id = ?
          ORDER BY e.created_at DESC
          LIMIT 1
        `).get(row.id) as any

        if (lastExecution) {
          pipeline.lastExecution = {
            id: lastExecution.id,
            status: lastExecution.status,
            startTime: lastExecution.started_at,
            endTime: lastExecution.completed_at,
            duration: lastExecution.duration_ms,
            completedSources: lastExecution.completed_sources,
            failedSources: lastExecution.failed_sources,
            totalSources: lastExecution.total_sources,
          }
        } else {
          pipeline.lastExecution = null
        }
      }

      return pipeline
    })

    return NextResponse.json({ pipelines: result })

  } catch (error) {
    console.error('❌ Error fetching pipelines:', error)
    return NextResponse.json(
      { error: 'Failed to fetch pipelines' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/pipelines
 * Create a new pipeline (formerly workflow)
 */
export async function POST(request: NextRequest) {
  try {
    const body: PipelineFormData = await request.json()
    const db = getDatabase()

    const now = Date.now()
    const id = `pl_${now}_${Math.random().toString(36).substring(7)}`

    db.prepare(`
      INSERT INTO pipelines (
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
      body.pipelineType === 'manual' ? 'manual' : 'scheduled',
      body.pipelineType,
      body.team,
      body.notificationEmail,
      JSON.stringify(body.tags || []),
      body.environment || 'development',
      body.priority || null,
      body.dataClassification || null,
      now,
      now
    )

    const pipeline: Pipeline = {
      id,
      name: body.name,
      description: body.description,
      application: body.application,
      owner: body.team,
      status: body.pipelineType === 'manual' ? 'manual' : 'scheduled',
      type: body.pipelineType,
      team: body.team,
      environment: body.environment || 'development',
      priority: body.priority,
      dataClassification: body.dataClassification,
      notificationEmail: body.notificationEmail,
      tags: body.tags || [],
      sources: [],
      createdAt: new Date(now),
      updatedAt: new Date(now)
    }

    console.log(`✅ Created pipeline: ${pipeline.name} (${id})`)

    return NextResponse.json({ pipeline })

  } catch (error) {
    console.error('❌ Error creating pipeline:', error)
    return NextResponse.json(
      { error: 'Failed to create pipeline' },
      { status: 500 }
    )
  }
}
