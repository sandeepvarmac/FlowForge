import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/:workflowId/triggers/dependencies
 * Get dependency graph for a workflow (upstream and downstream dependencies)
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
      SELECT id FROM pipelines WHERE id = ?
    `).get(workflowId)

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Get upstream workflows (workflows that this workflow depends on)
    // These are workflows that trigger this workflow when they complete
    const upstream = db.prepare(`
      SELECT
        t.id as trigger_id,
        t.depends_on_pipeline_id as workflow_id,
        w.name as workflow_name,
        t.dependency_condition as condition
      FROM pipeline_triggers t
      JOIN pipelines w ON t.depends_on_pipeline_id = w.id
      WHERE t.pipeline_id = ?
        AND t.trigger_type = 'dependency'
        AND t.enabled = 1
    `).all(workflowId) as any[]

    // Get downstream workflows (workflows that depend on this workflow)
    // These are workflows that will be triggered when this workflow completes
    const downstream = db.prepare(`
      SELECT
        t.id as trigger_id,
        t.pipeline_id as workflow_id,
        w.name as workflow_name,
        t.dependency_condition as condition
      FROM pipeline_triggers t
      JOIN pipelines w ON t.pipeline_id = w.id
      WHERE t.depends_on_pipeline_id = ?
        AND t.trigger_type = 'dependency'
        AND t.enabled = 1
    `).all(workflowId) as any[]

    return NextResponse.json({
      upstream: upstream.map(row => ({
        triggerId: row.trigger_id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name,
        condition: row.condition
      })),
      downstream: downstream.map(row => ({
        triggerId: row.trigger_id,
        workflowId: row.workflow_id,
        workflowName: row.workflow_name,
        condition: row.condition
      }))
    })
  } catch (error) {
    console.error('Error fetching dependency graph:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dependency graph' },
      { status: 500 }
    )
  }
}
