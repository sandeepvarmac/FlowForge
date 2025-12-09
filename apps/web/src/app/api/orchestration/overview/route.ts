import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const db = getDatabase()

    // System Health Check
    const systemHealth = await checkSystemHealth()

    // KPIs - Last 24 hours
    const kpis = await getKPIs(db)

    // Recent Activity - Last 50 executions
    const recentActivity = await getRecentActivity(db)

    // Success Rate Trends - Last 7 days
    const successRateTrends = await getSuccessRateTrends(db)

    return NextResponse.json({
      systemHealth,
      kpis,
      recentActivity,
      successRateTrends,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Error fetching overview metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch overview metrics' },
      { status: 500 }
    )
  }
}

// System Health Check
async function checkSystemHealth() {
  const health = {
    overall: 'operational' as 'operational' | 'degraded' | 'outage',
    services: {
      prefect: { status: 'unknown' as 'running' | 'stopped' | 'unknown', responseTime: 0 },
      minio: { status: 'unknown' as 'available' | 'unavailable' | 'unknown', responseTime: 0 },
      database: { status: 'unknown' as 'connected' | 'disconnected' | 'unknown', responseTime: 0 },
      queue: { status: 'unknown' as 'active' | 'inactive' | 'unknown', responseTime: 0 }
    }
  }

  try {
    // Check Prefect
    const prefectStart = Date.now()
    const prefectResponse = await fetch('http://127.0.0.1:4200/api/health', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    health.services.prefect = {
      status: prefectResponse.ok ? 'running' : 'stopped',
      responseTime: Date.now() - prefectStart
    }
  } catch (error) {
    health.services.prefect = { status: 'stopped', responseTime: 0 }
  }

  try {
    // Check MinIO
    const minioStart = Date.now()
    const minioResponse = await fetch('http://127.0.0.1:9000/minio/health/live', {
      method: 'GET',
      signal: AbortSignal.timeout(5000)
    })
    health.services.minio = {
      status: minioResponse.ok ? 'available' : 'unavailable',
      responseTime: Date.now() - minioStart
    }
  } catch (error) {
    health.services.minio = { status: 'unavailable', responseTime: 0 }
  }

  // Check Database
  try {
    const dbStart = Date.now()
    const db = getDatabase()
    db.prepare('SELECT 1').get()
    health.services.database = {
      status: 'connected',
      responseTime: Date.now() - dbStart
    }
  } catch (error) {
    health.services.database = { status: 'disconnected', responseTime: 0 }
  }

  // Check Queue (work pool status via Prefect)
  try {
    if (health.services.prefect.status === 'running') {
      const queueResponse = await fetch('http://127.0.0.1:4200/api/work_pools', {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      })
      if (queueResponse.ok) {
        const pools = await queueResponse.json()
        health.services.queue = {
          status: pools.length > 0 ? 'active' : 'inactive',
          responseTime: 0
        }
      }
    } else {
      health.services.queue = { status: 'inactive', responseTime: 0 }
    }
  } catch (error) {
    health.services.queue = { status: 'unknown', responseTime: 0 }
  }

  // Determine overall health
  const allRunning =
    health.services.prefect.status === 'running' &&
    health.services.minio.status === 'available' &&
    health.services.database.status === 'connected'

  const someRunning =
    health.services.prefect.status === 'running' ||
    health.services.minio.status === 'available' ||
    health.services.database.status === 'connected'

  health.overall = allRunning ? 'operational' : someRunning ? 'degraded' : 'outage'

  return health
}

// Get KPIs for last 24 hours
async function getKPIs(db: any) {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  // Active workflows
  const activeWorkflows = db.prepare(`
    SELECT COUNT(*) as count
    FROM pipelines
    WHERE status IN ('active', 'scheduled', 'manual')
  `).get() as { count: number }

  const activeWorkflowsYesterday = db.prepare(`
    SELECT COUNT(*) as count
    FROM pipelines
    WHERE status IN ('active', 'scheduled', 'manual')
    AND created_at < ?
  `).get(yesterday.toISOString()) as { count: number }

  // Successful runs (last 24h)
  const successfulRuns = db.prepare(`
    SELECT COUNT(*) as count
    FROM executions
    WHERE status = 'completed'
    AND created_at >= ?
  `).get(yesterday.toISOString()) as { count: number }

  const successfulRunsPrevious = db.prepare(`
    SELECT COUNT(*) as count
    FROM executions
    WHERE status = 'completed'
    AND created_at >= ?
    AND created_at < ?
  `).get(twoDaysAgo.toISOString(), yesterday.toISOString()) as { count: number }

  // Failed runs (last 24h)
  const failedRuns = db.prepare(`
    SELECT COUNT(*) as count
    FROM executions
    WHERE status = 'failed'
    AND created_at >= ?
  `).get(yesterday.toISOString()) as { count: number }

  const failedRunsPrevious = db.prepare(`
    SELECT COUNT(*) as count
    FROM executions
    WHERE status = 'failed'
    AND created_at >= ?
    AND created_at < ?
  `).get(twoDaysAgo.toISOString(), yesterday.toISOString()) as { count: number }

  // Data processed (placeholder - would come from source_executions)
  const dataProcessed = db.prepare(`
    SELECT
      COALESCE(SUM(records_processed), 0) as totalRows,
      COUNT(*) as totalJobs
    FROM source_executions
    WHERE created_at >= ?
  `).get(yesterday.toISOString()) as { totalRows: number, totalJobs: number }

  const dataProcessedPrevious = db.prepare(`
    SELECT
      COALESCE(SUM(records_processed), 0) as totalRows,
      COUNT(*) as totalJobs
    FROM source_executions
    WHERE created_at >= ?
    AND created_at < ?
  `).get(twoDaysAgo.toISOString(), yesterday.toISOString()) as { totalRows: number, totalJobs: number }

  return {
    activeWorkflows: {
      value: activeWorkflows.count,
      change: activeWorkflows.count - activeWorkflowsYesterday.count,
      changePercent: activeWorkflowsYesterday.count > 0
        ? ((activeWorkflows.count - activeWorkflowsYesterday.count) / activeWorkflowsYesterday.count * 100)
        : 0
    },
    successfulRuns: {
      value: successfulRuns.count,
      change: successfulRuns.count - successfulRunsPrevious.count,
      changePercent: successfulRunsPrevious.count > 0
        ? ((successfulRuns.count - successfulRunsPrevious.count) / successfulRunsPrevious.count * 100)
        : 0
    },
    failedRuns: {
      value: failedRuns.count,
      change: failedRuns.count - failedRunsPrevious.count,
      changePercent: failedRunsPrevious.count > 0
        ? ((failedRuns.count - failedRunsPrevious.count) / failedRunsPrevious.count * 100)
        : 0
    },
    dataProcessed: {
      value: dataProcessed.totalRows,
      valueFormatted: formatBytes(dataProcessed.totalRows * 100), // Rough estimate: 100 bytes per row
      change: dataProcessed.totalRows - dataProcessedPrevious.totalRows,
      changePercent: dataProcessedPrevious.totalRows > 0
        ? ((dataProcessed.totalRows - dataProcessedPrevious.totalRows) / dataProcessedPrevious.totalRows * 100)
        : 0
    }
  }
}

// Get recent activity (last 50 executions)
async function getRecentActivity(db: any) {
  const executions = db.prepare(`
    SELECT
      e.id,
      e.pipeline_id,
      e.status,
      e.started_at,
      e.completed_at,
      e.duration_ms,
      p.name as pipeline_name,
      (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id) as total_sources,
      (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'completed') as completed_sources,
      (SELECT COUNT(*) FROM source_executions se WHERE se.execution_id = e.id AND se.status = 'failed') as failed_sources
    FROM executions e
    JOIN pipelines p ON e.pipeline_id = p.id
    ORDER BY e.created_at DESC
    LIMIT 50
  `).all() as any[]

  return executions.map(exec => ({
    id: exec.id,
    pipelineId: exec.pipeline_id,
    pipelineName: exec.pipeline_name,
    // Keep legacy field names for backward compatibility
    workflowId: exec.pipeline_id,
    workflowName: exec.pipeline_name,
    status: exec.status,
    startedAt: exec.started_at ? new Date(exec.started_at) : null,
    completedAt: exec.completed_at ? new Date(exec.completed_at) : null,
    duration: exec.duration_ms,
    totalSources: exec.total_sources,
    completedSources: exec.completed_sources,
    failedSources: exec.failed_sources,
    // Legacy field names
    totalJobs: exec.total_sources,
    completedJobs: exec.completed_sources,
    failedJobs: exec.failed_sources
  }))
}

// Get success rate trends for last 7 days
async function getSuccessRateTrends(db: any) {
  const trends = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000)

    const stats = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
      FROM executions
      WHERE created_at >= ? AND created_at < ?
    `).get(date.toISOString(), nextDate.toISOString()) as any

    trends.push({
      date: date.toISOString().split('T')[0],
      total: stats.total || 0,
      successful: stats.successful || 0,
      failed: stats.failed || 0,
      running: stats.running || 0,
      successRate: stats.total > 0 ? (stats.successful / stats.total * 100) : 0
    })
  }

  return trends
}

// Helper function to format bytes
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}
