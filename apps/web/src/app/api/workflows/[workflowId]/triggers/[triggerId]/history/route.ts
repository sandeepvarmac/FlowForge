import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/:workflowId/triggers/:triggerId/history
 * Get execution history for a specific trigger
 *
 * Query params:
 * - limit: number of executions to return (default: 10, max: 50)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
    const db = getDatabase()

    // Check if trigger exists
    const trigger = db.prepare(`
      SELECT * FROM pipeline_triggers WHERE id = ? AND pipeline_id = ?
    `).get(triggerId, workflowId)

    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    // Get executions triggered by this trigger
    const executions = db.prepare(`
      SELECT
        id as execution_id,
        status,
        started_at as triggered_at,
        duration_ms
      FROM executions
      WHERE pipeline_id = ?
        AND trigger_id = ?
      ORDER BY started_at DESC
      LIMIT ?
    `).all(workflowId, triggerId, limit) as any[]

    return NextResponse.json({
      history: executions.map(exec => ({
        executionId: exec.execution_id,
        status: exec.status,
        triggeredAt: exec.triggered_at,
        duration: exec.duration_ms
      }))
    })
  } catch (error) {
    console.error('Error fetching trigger history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trigger history' },
      { status: 500 }
    )
  }
}
