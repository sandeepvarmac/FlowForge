import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Check for circular dependencies using depth-first search
 */
function hasCircularDependency(
  db: any,
  startWorkflowId: string,
  targetWorkflowId: string,
  visited = new Set<string>(),
  path: string[] = []
): { hasCircle: boolean; chain?: string[] } {
  // If we've reached the target, we have a circle
  if (startWorkflowId === targetWorkflowId) {
    return { hasCircle: true, chain: [...path, startWorkflowId] }
  }

  // If we've already visited this node, no circle from this path
  if (visited.has(startWorkflowId)) {
    return { hasCircle: false }
  }

  // Mark as visited
  visited.add(startWorkflowId)
  path.push(startWorkflowId)

  // Get all workflows that startWorkflowId depends on
  const dependencies = db.prepare(`
    SELECT DISTINCT depends_on_workflow_id
    FROM workflow_triggers
    WHERE workflow_id = ?
      AND trigger_type = 'dependency'
      AND depends_on_workflow_id IS NOT NULL
  `).all(startWorkflowId) as any[]

  // Check each dependency recursively
  for (const dep of dependencies) {
    const result = hasCircularDependency(
      db,
      dep.depends_on_workflow_id,
      targetWorkflowId,
      visited,
      [...path]
    )
    if (result.hasCircle) {
      return result
    }
  }

  return { hasCircle: false }
}

/**
 * POST /api/workflows/:workflowId/triggers/validate-dependency
 * Validate if adding a dependency would create a circular dependency
 *
 * Body:
 * - dependsOnWorkflowId: workflow ID to depend on
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const body = await request.json()
    const db = getDatabase()

    if (!body.dependsOnWorkflowId) {
      return NextResponse.json(
        { error: 'dependsOnWorkflowId is required' },
        { status: 400 }
      )
    }

    const { dependsOnWorkflowId } = body

    // Check if workflows exist
    const workflow = db.prepare(`
      SELECT id, name FROM workflows WHERE id = ?
    `).get(workflowId)

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const upstreamWorkflow = db.prepare(`
      SELECT id, name FROM workflows WHERE id = ?
    `).get(dependsOnWorkflowId)

    if (!upstreamWorkflow) {
      return NextResponse.json(
        { error: 'Upstream workflow not found' },
        { status: 404 }
      )
    }

    // Check for self-dependency
    if (workflowId === dependsOnWorkflowId) {
      return NextResponse.json({
        valid: false,
        error: 'A workflow cannot depend on itself',
        chain: [workflowId]
      })
    }

    // Check for circular dependency
    // If dependsOnWorkflow already depends on this workflow (directly or indirectly),
    // adding this dependency would create a circle
    const result = hasCircularDependency(db, dependsOnWorkflowId, workflowId)

    if (result.hasCircle) {
      // Get workflow names for the chain
      const chainWithNames = result.chain?.map(id => {
        const w = db.prepare(`SELECT name FROM workflows WHERE id = ?`).get(id) as any
        return `${w?.name || id}`
      }) || []

      return NextResponse.json({
        valid: false,
        error: 'Circular dependency detected',
        chain: chainWithNames,
        message: `Adding this dependency would create a circular chain: ${chainWithNames.join(' → ')}`
      })
    }

    // Valid dependency
    return NextResponse.json({
      valid: true,
      message: `${workflow.name} can safely depend on ${upstreamWorkflow.name}`
    })
  } catch (error) {
    console.error('Error validating dependency:', error)
    return NextResponse.json(
      { error: 'Failed to validate dependency' },
      { status: 500 }
    )
  }
}
