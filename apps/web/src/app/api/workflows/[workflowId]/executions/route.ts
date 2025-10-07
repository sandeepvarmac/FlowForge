import type { Database as SqliteDatabase } from 'better-sqlite3'
import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

const PREFECT_API_URL = (process.env.PREFECT_API_URL || 'http://127.0.0.1:4200/api').replace(/\/$/, '')
const PREFECT_API_KEY = process.env.PREFECT_API_KEY
const TERMINAL_STATES = new Set(['completed', 'failed', 'crashed', 'cancelled'])

function parseLogField(value: unknown): string[] {
  if (!value) return []

  if (Array.isArray(value)) {
    return value.filter(entry => typeof entry === 'string') as string[]
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.filter(entry => typeof entry === 'string') as string[]
      }
      return [value]
    } catch {
      return [value]
    }
  }

  return []
}

async function prefectRequest(path: string): Promise<any | null> {
  if (!PREFECT_API_URL) {
    return null
  }

  try {
    const headers: HeadersInit = {
      Accept: 'application/json'
    }

    if (PREFECT_API_KEY) {
      headers.Authorization = `Bearer ${PREFECT_API_KEY}`
    }

    const response = await fetch(`${PREFECT_API_URL}${path}`, {
      method: 'GET',
      cache: 'no-store',
      headers
    })

    if (!response.ok) {
      console.error(`Prefect request failed: ${response.status} ${response.statusText}`)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('Prefect request error:', error)
    return null
  }
}

async function fetchFlowRunLogs(flowRunId: string): Promise<string[]> {
  if (!PREFECT_API_URL) {
    return []
  }

  try {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }

    if (PREFECT_API_KEY) {
      headers.Authorization = `Bearer ${PREFECT_API_KEY}`
    }

    const response = await fetch(`${PREFECT_API_URL}/logs/filter`, {
      method: 'POST',
      cache: 'no-store',
      headers,
      body: JSON.stringify({
        logs: {
          flow_run_id: {
            any_: [flowRunId]
          }
        },
        sort: 'TIMESTAMP_ASC',
        limit: 200
      })
    })

    if (!response.ok) {
      console.error(`Prefect logs request failed: ${response.status} ${response.statusText}`)
      return []
    }

    const rawLogs = await response.json()
    const logs = Array.isArray(rawLogs) ? rawLogs : []

    return logs.map((entry: any) => {
      const levelName = entry.level === 20 ? 'INFO' : entry.level === 40 ? 'ERROR' : entry.level === 30 ? 'WARNING' : 'DEBUG'
      const level = `[${levelName}] `
      const message = entry.message || JSON.stringify(entry)
      return `${level}${message}`
    })
  } catch (error) {
    console.error('Prefect logs request error:', error)
    return []
  }
}

function extractFlowRunIdFromLogs(serialisedLogs?: string | null): string | null {
  if (!serialisedLogs) {
    return null
  }

  try {
    const logs = JSON.parse(serialisedLogs)
    if (!Array.isArray(logs)) {
      return null
    }

    for (const entry of logs) {
      if (typeof entry !== 'string') continue
      const match = entry.match(/Prefect flow run created: ([-0-9a-f]+)/i)
      if (match) {
        return match[1]
      }
    }
  } catch (error) {
    console.error('Failed to parse job execution logs:', error)
  }

  return null
}

async function syncPrefectExecutions(database: SqliteDatabase, workflowId: string) {
  const inflightJobs = database.prepare(`
    SELECT
      je.id,
      je.execution_id,
      je.job_id,
      je.status,
      je.started_at,
      je.logs,
      je.flow_run_id,
      e.started_at AS execution_started_at
    FROM job_executions je
    JOIN executions e ON je.execution_id = e.id
    WHERE e.workflow_id = ?
      AND je.status IN ('running', 'pending')
  `).all(workflowId) as Array<{
    id: string
    execution_id: string
    job_id: string
    status: string
    started_at: string
    logs?: string | null
    flow_run_id?: string | null
    execution_started_at: string
  }>

  if (inflightJobs.length === 0) {
    return
  }

  const executionIdsToRefresh = new Set<string>()

  for (const job of inflightJobs) {
    let flowRunId = job.flow_run_id || extractFlowRunIdFromLogs(job.logs)

    if (!flowRunId) {
      continue
    }

    if (!job.flow_run_id && flowRunId) {
      database.prepare(`
        UPDATE job_executions
        SET flow_run_id = ?, updated_at = ?
        WHERE id = ?
      `).run(flowRunId, new Date().toISOString(), job.id)
    }

    const flowRun = await prefectRequest(`/flow_runs/${flowRunId}`)
    if (!flowRun) {
      continue
    }

    const state = flowRun.state || {}
    const stateType = typeof state.type === 'string' ? state.type.toLowerCase() : undefined

    const logMessages = await fetchFlowRunLogs(flowRunId)
    const nowIso = new Date().toISOString()

    if (stateType && TERMINAL_STATES.has(stateType)) {
      const completedIso = state.state_details?.timestamp || state.timestamp || nowIso
      const durationMsRaw = (() => {
        try {
          return new Date(completedIso).getTime() - new Date(job.started_at).getTime()
        } catch {
          return null
        }
      })()
      const durationMs = Number.isFinite(durationMsRaw) ? durationMsRaw : null

      const status = stateType === 'completed' ? 'completed' : 'failed'
      const errorMessage = status === 'failed'
        ? state.message || state.name || stateType.toUpperCase()
        : null

      database.prepare(`
        UPDATE job_executions
        SET status = ?, completed_at = ?, duration_ms = ?, logs = ?, error_message = ?, updated_at = ?
        WHERE id = ?
      `).run(
        status,
        completedIso,
        durationMs,
        JSON.stringify(logMessages),
        errorMessage,
        nowIso,
        job.id
      )

      executionIdsToRefresh.add(job.execution_id)
    } else if (logMessages.length > 0) {
      database.prepare(`
        UPDATE job_executions
        SET logs = ?, updated_at = ?
        WHERE id = ?
      `).run(JSON.stringify(logMessages), nowIso, job.id)
    }
  }

  executionIdsToRefresh.forEach(executionId => {
    const jobStatuses = database.prepare(`
      SELECT status FROM job_executions WHERE execution_id = ?
    `).all(executionId) as Array<{ status: string }>

    if (jobStatuses.length === 0) {
      return
    }

    let nextStatus: 'running' | 'completed' | 'failed' = 'running'

    if (jobStatuses.some(job => job.status === 'failed')) {
      nextStatus = 'failed'
    } else if (jobStatuses.every(job => job.status === 'completed')) {
      nextStatus = 'completed'
    }

    const execution = database.prepare(`
      SELECT status, started_at FROM executions WHERE id = ?
    `).get(executionId) as { status: string; started_at: string } | undefined

    if (!execution || execution.status === nextStatus) {
      return
    }

    const updatedAt = new Date().toISOString()
    const completedAt = nextStatus === 'running' ? null : updatedAt
    const durationMsRaw = completedAt
      ? new Date(completedAt).getTime() - new Date(execution.started_at).getTime()
      : null
    const durationMs = Number.isFinite(durationMsRaw) ? durationMsRaw : null

    database.prepare(`
      UPDATE executions
      SET status = ?, completed_at = ?, duration_ms = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, completedAt, durationMs, updatedAt, executionId)
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    await syncPrefectExecutions(db, workflowId)

    const executions = db.prepare(`
      SELECT
        e.*,
        (
          SELECT COUNT(*)
          FROM job_executions je
          WHERE je.execution_id = e.id AND je.status = 'completed'
        ) as completed_jobs,
        (
          SELECT COUNT(*)
          FROM job_executions je
          WHERE je.execution_id = e.id AND je.status = 'failed'
        ) as failed_jobs,
        (
          SELECT SUM(je.records_processed)
          FROM job_executions je
          WHERE je.execution_id = e.id
        ) as total_records
      FROM executions e
      WHERE e.workflow_id = ?
      ORDER BY e.created_at DESC
      LIMIT 50
    `).all(workflowId)

    const executionsWithJobs = executions.map((execution: any) => {
      const rawJobExecutions = db.prepare(`
        SELECT
          je.*,
          j.name as job_name,
          j.type as job_type
        FROM job_executions je
        JOIN jobs j ON je.job_id = j.id
        WHERE je.execution_id = ?
        ORDER BY je.created_at ASC
      `).all(execution.id)

      const jobExecutions = rawJobExecutions.map((je: any) => {
        const logs = parseLogField(je.logs)
        return {
          id: je.id,
          jobId: je.job_id,
          jobName: je.job_name,
          jobType: je.job_type,
          status: je.status,
          startedAt: je.started_at ?? null,
          completedAt: je.completed_at ?? null,
          durationMs: je.duration_ms ?? null,
          recordsProcessed: je.records_processed ?? null,
          bronzeFilePath: je.bronze_file_path ?? null,
          silverFilePath: je.silver_file_path ?? null,
          goldFilePath: je.gold_file_path ?? null,
          logs,
          error: je.error_message ?? null,
          flowRunId: je.flow_run_id ?? null,
          createdAt: je.created_at ?? null,
          updatedAt: je.updated_at ?? null
        }
      })

      const aggregatedLogs = jobExecutions.flatMap(job => job.logs || [])
      const executionError = jobExecutions.find(job => job.status === 'failed')?.error ?? null

      return {
        id: execution.id,
        workflowId: execution.workflow_id,
        status: execution.status,
        startTime: execution.started_at ?? null,
        endTime: execution.completed_at ?? null,
        duration: execution.duration_ms ?? null,
        logs: aggregatedLogs,
        error: executionError,
        completedJobs: execution.completed_jobs,
        failedJobs: execution.failed_jobs,
        totalRecords: execution.total_records ?? 0,
        createdAt: execution.created_at ?? null,
        updatedAt: execution.updated_at ?? null,
        jobExecutions
      }
    })

    return NextResponse.json({ executions: executionsWithJobs })

  } catch (error: any) {
    console.error('Error fetching executions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch executions' },
      { status: 500 }
    )
  }
}
