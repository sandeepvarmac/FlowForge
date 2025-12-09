import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // Parse filters
    const status = searchParams.get('status')?.split(',').filter(Boolean) || []
    const workflowIds = searchParams.get('workflowIds')?.split(',').filter(Boolean) || []
    const timeRange = searchParams.get('timeRange') || '24h'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const db = getDatabase()

    // Calculate time range filter
    const now = Date.now()
    let startTime: string
    switch (timeRange) {
      case '1h':
        startTime = new Date(now - 3600000).toISOString()
        break
      case '6h':
        startTime = new Date(now - 6 * 3600000).toISOString()
        break
      case '24h':
        startTime = new Date(now - 24 * 3600000).toISOString()
        break
      case '7d':
        startTime = new Date(now - 7 * 24 * 3600000).toISOString()
        break
      case '30d':
        startTime = new Date(now - 30 * 24 * 3600000).toISOString()
        break
      default:
        startTime = new Date(now - 24 * 3600000).toISOString()
    }

    // Build WHERE clause
    const conditions: string[] = [`e.started_at >= ?`]
    const params: any[] = [startTime]

    if (status.length > 0) {
      conditions.push(`e.status IN (${status.map(() => '?').join(',')})`)
      params.push(...status)
    }

    if (workflowIds.length > 0) {
      conditions.push(`e.pipeline_id IN (${workflowIds.map(() => '?').join(',')})`)
      params.push(...workflowIds)
    }

    if (search) {
      conditions.push(`(p.name LIKE ? OR e.id LIKE ?)`)
      params.push(`%${search}%`, `%${search}%`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM executions e
      JOIN pipelines p ON e.pipeline_id = p.id
      ${whereClause}
    `
    const countResult = db.prepare(countQuery).get(...params) as { total: number }
    const total = countResult.total

    // Get executions with pipeline info and source execution counts
    const executionsQuery = `
      SELECT
        e.id,
        e.pipeline_id,
        e.status,
        e.started_at,
        e.completed_at,
        e.duration_ms,
        p.name as pipeline_name,
        p.description as pipeline_description,
        (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id) as total_sources,
        (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'completed') as completed_sources,
        (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'failed') as failed_sources,
        (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'running') as running_sources,
        (SELECT SUM(se.records_processed) FROM source_executions se WHERE se.execution_id = e.id) as total_records_processed
      FROM executions e
      JOIN pipelines p ON e.pipeline_id = p.id
      ${whereClause}
      ORDER BY e.started_at DESC
      LIMIT ? OFFSET ?
    `

    const executions = db.prepare(executionsQuery).all(...params, limit, offset)

    // Get quick stats
    const statsQuery = `
      SELECT
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled
      FROM executions
      WHERE started_at >= ?
    `
    const stats = db.prepare(statsQuery).get(startTime)

    // Get pipeline list for filter dropdown
    const pipelinesQuery = `
      SELECT DISTINCT p.id, p.name
      FROM pipelines p
      JOIN executions e ON p.id = e.pipeline_id
      WHERE e.started_at >= ?
      ORDER BY p.name
    `
    const pipelines = db.prepare(pipelinesQuery).all(startTime)

    return NextResponse.json({
      executions,
      stats,
      pipelines,
      // Legacy field name for backward compatibility
      workflows: pipelines,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      filters: {
        status,
        workflowIds,
        timeRange,
        search
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Error fetching monitor data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch monitor data' },
      { status: 500 }
    )
  }
}
