import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/available-upstream
 * Get list of workflows that can be used as upstream dependencies
 *
 * Query params:
 * - excludeWorkflowId: workflow ID to exclude from results (typically the current workflow)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const excludeWorkflowId = searchParams.get('excludeWorkflowId')
    const db = getDatabase()

    let query = `
      SELECT
        id,
        name,
        description,
        type,
        status
      FROM pipelines
      WHERE 1=1
    `

    const params: any[] = []

    // Exclude specific workflow (typically the current workflow)
    if (excludeWorkflowId) {
      query += ` AND id != ?`
      params.push(excludeWorkflowId)
    }

    // Order by name for easy selection
    query += ` ORDER BY name ASC`

    const workflows = db.prepare(query).all(...params) as any[]

    return NextResponse.json({
      workflows: workflows.map(w => ({
        id: w.id,
        name: w.name,
        description: w.description,
        type: w.type,
        status: w.status
      }))
    })
  } catch (error) {
    console.error('Error fetching available workflows:', error)
    return NextResponse.json(
      { error: 'Failed to fetch available workflows' },
      { status: 500 }
    )
  }
}
