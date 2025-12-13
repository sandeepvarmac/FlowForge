import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const timeRange = searchParams.get('timeRange') || '30d'

    const db = getDatabase()

    // Calculate time range
    const now = Date.now()
    let startTime: string
    let days: number
    switch (timeRange) {
      case '7d':
        days = 7
        startTime = new Date(now - 7 * 24 * 3600000).toISOString()
        break
      case '30d':
        days = 30
        startTime = new Date(now - 30 * 24 * 3600000).toISOString()
        break
      case '90d':
        days = 90
        startTime = new Date(now - 90 * 24 * 3600000).toISOString()
        break
      default:
        days = 30
        startTime = new Date(now - 30 * 24 * 3600000).toISOString()
    }

    // Duration trends by day
    const durationTrendsQuery = `
      SELECT
        DATE(started_at) as date,
        COUNT(*) as execution_count,
        AVG(duration_ms) as avg_duration,
        MIN(duration_ms) as min_duration,
        MAX(duration_ms) as max_duration,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM executions
      WHERE started_at >= ? AND duration_ms IS NOT NULL
      GROUP BY DATE(started_at)
      ORDER BY date DESC
      LIMIT ?
    `
    const durationTrends = db.prepare(durationTrendsQuery).all(startTime, days)

    // Duration by workflow
    const durationByWorkflowQuery = `
      SELECT
        w.name as workflow_name,
        w.id as workflow_id,
        COUNT(e.id) as execution_count,
        AVG(e.duration_ms) as avg_duration,
        MIN(e.duration_ms) as min_duration,
        MAX(e.duration_ms) as max_duration,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as success_count,
        COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failure_count
      FROM pipelines w
      JOIN executions e ON w.id = e.pipeline_id
      WHERE e.started_at >= ? AND e.duration_ms IS NOT NULL
      GROUP BY w.id, w.name
      ORDER BY execution_count DESC
      LIMIT 10
    `
    const durationByWorkflow = db.prepare(durationByWorkflowQuery).all(startTime)

    // Throughput analysis (executions per hour)
    const throughputQuery = `
      SELECT
        strftime('%Y-%m-%d %H:00:00', started_at) as hour,
        COUNT(*) as execution_count,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_count
      FROM executions
      WHERE started_at >= ?
      GROUP BY strftime('%Y-%m-%d %H:00:00', started_at)
      ORDER BY hour DESC
      LIMIT 168
    `
    const throughput = db.prepare(throughputQuery).all(startTime)

    // Resource efficiency metrics
    const efficiencyQuery = `
      SELECT
        COUNT(*) as total_executions,
        SUM(se.records_processed) as total_records,
        AVG(se.records_processed * 1000.0 / NULLIF(se.duration_ms, 0)) as avg_records_per_second,
        SUM(se.bronze_records) as total_bronze_records,
        SUM(se.silver_records) as total_silver_records,
        SUM(se.gold_records) as total_gold_records,
        AVG(se.duration_ms) as avg_job_duration
      FROM source_executions se
      JOIN executions e ON se.execution_id = e.id
      WHERE e.started_at >= ? AND se.duration_ms > 0
    `
    const efficiency = db.prepare(efficiencyQuery).get(startTime)

    // Failure analysis
    const failureAnalysisQuery = `
      SELECT
        w.name as workflow_name,
        w.id as workflow_id,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failure_count,
        CAST(COUNT(CASE WHEN e.status = 'failed' THEN 1 END) * 100.0 / COUNT(*) AS REAL) as failure_rate
      FROM pipelines w
      JOIN executions e ON w.id = e.pipeline_id
      WHERE e.started_at >= ?
      GROUP BY w.id, w.name
      HAVING failure_count > 0
      ORDER BY failure_rate DESC
      LIMIT 10
    `
    const failureAnalysis = db.prepare(failureAnalysisQuery).all(startTime)

    // Top failing jobs
    const topFailingJobsQuery = `
      SELECT
        j.name as job_name,
        j.id as job_id,
        j.type as job_type,
        w.name as workflow_name,
        COUNT(*) as total_runs,
        COUNT(CASE WHEN je.status = 'failed' THEN 1 END) as failure_count,
        CAST(COUNT(CASE WHEN je.status = 'failed' THEN 1 END) * 100.0 / COUNT(*) AS REAL) as failure_rate,
        je.error_message as last_error
      FROM sources j
      JOIN source_executions je ON j.id = je.source_id
      JOIN executions e ON je.execution_id = e.id
      JOIN pipelines w ON j.pipeline_id = w.id
      WHERE e.started_at >= ?
      GROUP BY j.id, j.name, j.type, w.name, je.error_message
      HAVING failure_count > 0
      ORDER BY failure_count DESC
      LIMIT 10
    `
    const topFailingJobs = db.prepare(topFailingJobsQuery).all(startTime)

    return NextResponse.json({
      durationTrends,
      durationByWorkflow,
      throughput,
      efficiency,
      failureAnalysis,
      topFailingJobs,
      timeRange,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Error fetching performance metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch performance metrics' },
      { status: 500 }
    )
  }
}
