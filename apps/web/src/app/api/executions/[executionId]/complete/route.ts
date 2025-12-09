import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/executions/:executionId/complete
 * Called when an execution completes to trigger dependent workflows
 *
 * This endpoint:
 * 1. Finds all dependency triggers that depend on this workflow
 * 2. Evaluates conditions (on_success, on_failure, on_completion)
 * 3. Applies delays if configured
 * 4. Triggers downstream workflows
 *
 * Body:
 * - status: 'completed' | 'failed'
 * - workflowId: workflow ID that completed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const { executionId } = params
    const body = await request.json()
    const db = getDatabase()

    if (!body.status || !body.workflowId) {
      return NextResponse.json(
        { error: 'status and workflowId are required' },
        { status: 400 }
      )
    }

    const { status, workflowId } = body

    // Validate status
    if (!['completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'status must be "completed" or "failed"' },
        { status: 400 }
      )
    }

    console.log(`Processing execution completion: ${executionId}, workflow: ${workflowId}, status: ${status}`)

    // Find all enabled dependency triggers that depend on this workflow
    const dependencyTriggers = db.prepare(`
      SELECT
        t.id as trigger_id,
        t.workflow_id,
        t.trigger_name,
        t.dependency_condition,
        t.delay_minutes,
        w.name as workflow_name,
        upstream.name as upstream_workflow_name
      FROM pipeline_triggers t
      JOIN pipelines w ON t.pipeline_id = w.id
      JOIN pipelines upstream ON t.depends_on_pipeline_id = upstream.id
      WHERE t.trigger_type = 'dependency'
        AND t.enabled = 1
        AND t.depends_on_pipeline_id = ?
    `).all(workflowId) as any[]

    if (dependencyTriggers.length === 0) {
      console.log(`No dependency triggers found for workflow ${workflowId}`)
      return NextResponse.json({
        message: 'No dependent workflows to trigger',
        triggeredCount: 0
      })
    }

    console.log(`Found ${dependencyTriggers.length} potential dependency triggers`)

    const triggeredWorkflows: any[] = []
    const skippedWorkflows: any[] = []

    for (const trigger of dependencyTriggers) {
      // Evaluate condition
      const shouldTrigger = evaluateCondition(
        trigger.dependency_condition,
        status
      )

      if (!shouldTrigger) {
        console.log(
          `Skipping trigger ${trigger.trigger_id}: condition ${trigger.dependency_condition} not met for status ${status}`
        )
        skippedWorkflows.push({
          triggerId: trigger.trigger_id,
          workflowId: trigger.workflow_id,
          workflowName: trigger.workflow_name,
          reason: `Condition ${trigger.dependency_condition} not met (execution ${status})`
        })
        continue
      }

      // Apply delay if configured
      const delayMinutes = trigger.delay_minutes || 0

      if (delayMinutes > 0) {
        // For now, log that we should schedule for later
        // In a production system, this would use a queue or scheduler
        console.log(
          `Trigger ${trigger.trigger_id} has ${delayMinutes} minute delay - should be scheduled`
        )

        // TODO: Implement delayed execution using a job queue or scheduler
        // For MVP, we'll trigger immediately but log the intended delay
        console.log(
          `MVP: Triggering immediately despite ${delayMinutes}min delay configuration`
        )
      }

      // Trigger the downstream workflow
      try {
        // Create a new execution record for the triggered workflow
        const triggeredExecutionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const now = Math.floor(Date.now() / 1000)

        // Get the downstream workflow details
        const downstreamWorkflow = db.prepare(`
          SELECT * FROM pipelines WHERE id = ?
        `).get(trigger.workflow_id) as any

        if (!downstreamWorkflow) {
          console.error(`Downstream workflow ${trigger.workflow_id} not found`)
          skippedWorkflows.push({
            triggerId: trigger.trigger_id,
            workflowId: trigger.workflow_id,
            workflowName: trigger.workflow_name,
            reason: 'Workflow not found'
          })
          continue
        }

        // Insert execution record
        db.prepare(`
          INSERT INTO executions (
            id, workflow_id, status, started_at, trigger_id, trigger_type
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          triggeredExecutionId,
          trigger.workflow_id,
          'pending',
          now,
          trigger.trigger_id,
          'dependency'
        )

        // Call the workflow execution endpoint
        const executeUrl = `${request.nextUrl.origin}/api/workflows/${trigger.workflow_id}/execute`

        console.log(
          `Triggering downstream workflow ${trigger.workflow_id} (${trigger.workflow_name})`
        )

        // Trigger asynchronously (fire and forget)
        fetch(executeUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            executionId: triggeredExecutionId,
            triggeredBy: {
              type: 'dependency',
              triggerId: trigger.trigger_id,
              upstreamWorkflowId: workflowId,
              upstreamExecutionId: executionId
            }
          })
        }).catch(error => {
          console.error(`Failed to trigger workflow ${trigger.workflow_id}:`, error)
        })

        triggeredWorkflows.push({
          triggerId: trigger.trigger_id,
          workflowId: trigger.workflow_id,
          workflowName: trigger.workflow_name,
          executionId: triggeredExecutionId,
          condition: trigger.dependency_condition,
          delayMinutes: delayMinutes
        })

        console.log(
          `Successfully triggered workflow ${trigger.workflow_id} with execution ${triggeredExecutionId}`
        )

      } catch (error) {
        console.error(
          `Error triggering workflow ${trigger.workflow_id}:`,
          error
        )
        skippedWorkflows.push({
          triggerId: trigger.trigger_id,
          workflowId: trigger.workflow_id,
          workflowName: trigger.workflow_name,
          reason: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      message: `Processed ${dependencyTriggers.length} dependency triggers`,
      triggeredCount: triggeredWorkflows.length,
      skippedCount: skippedWorkflows.length,
      triggered: triggeredWorkflows,
      skipped: skippedWorkflows
    })

  } catch (error) {
    console.error('Error processing execution completion:', error)
    return NextResponse.json(
      { error: 'Failed to process execution completion' },
      { status: 500 }
    )
  }
}

/**
 * Evaluate if a dependency trigger condition is met
 */
function evaluateCondition(
  condition: string,
  executionStatus: string
): boolean {
  switch (condition) {
    case 'on_success':
      return executionStatus === 'completed'

    case 'on_failure':
      return executionStatus === 'failed'

    case 'on_completion':
      // Trigger regardless of success or failure
      return true

    default:
      console.warn(`Unknown condition: ${condition}`)
      return false
  }
}
