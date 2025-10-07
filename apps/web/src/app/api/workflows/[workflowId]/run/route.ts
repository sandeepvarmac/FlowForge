import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

const PREFECT_API_URL = (process.env.PREFECT_API_URL || 'http://127.0.0.1:4200/api').replace(/\/$/, '')
const PREFECT_DEPLOYMENT_ID = process.env.PREFECT_DEPLOYMENT_ID || '6418e5a3-9205-4fa6-a5fe-6e852c32281a'

interface PrefectRunResponse {
  id: string
  name?: string
  state_id?: string
}

async function triggerPrefectRun(
  deploymentId: string,
  parameters: Record<string, unknown>
): Promise<PrefectRunResponse> {
  const url = `${PREFECT_API_URL}/deployments/${deploymentId}/create_flow_run`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ parameters })
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Prefect request failed (${response.status}): ${detail}`)
  }

  return response.json() as Promise<PrefectRunResponse>
}

export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    const workflow = db.prepare(`
      SELECT * FROM workflows WHERE id = ?
    `).get(workflowId) as any

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE workflow_id = ? ORDER BY order_index ASC
    `).all(workflowId) as any[]

    if (!jobs?.length) {
      return NextResponse.json(
        { error: 'No jobs found in workflow' },
        { status: 400 }
      )
    }

    console.log(`🚀 Scheduling Prefect runs for workflow ${workflow.name} (${workflowId})`)

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const startTime = new Date().toISOString()

    db.prepare(`
      INSERT INTO executions (id, workflow_id, status, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(executionId, workflowId, 'running', startTime, startTime, startTime)

    const jobResults: Array<Record<string, unknown>> = []
    let overallStatus: 'running' | 'failed' = 'running'

    for (const job of jobs) {
      const jobStartTime = new Date().toISOString()
      const jobExecutionId = `job_exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      db.prepare(`
        INSERT INTO job_executions (id, execution_id, job_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(jobExecutionId, executionId, job.id, 'running', jobStartTime, jobStartTime, jobStartTime)

      const sourceConfig = typeof job.source_config === 'string' ? JSON.parse(job.source_config) : job.source_config
      const landingKey = sourceConfig?.landingKey || `landing/${workflowId}/${job.id}/${sourceConfig?.fileConfig?.filePath || ''}`
      const prefectConfig = sourceConfig?.prefect ?? {}
      const deploymentId = prefectConfig.deploymentId || PREFECT_DEPLOYMENT_ID
      const primaryKeys = prefectConfig.parameters?.primary_keys || []

      try {
        const prefectRun = await triggerPrefectRun(deploymentId, {
          workflow_id: workflowId,
          job_id: job.id,
          workflow_name: workflow.name,
          job_name: job.name,
          landing_key: landingKey,
          primary_keys: primaryKeys,
          flow_run_id: null  // Will be set by Prefect
        })

        const logEntry = [`Prefect flow run created: ${prefectRun.id}`]
        db.prepare(`
          UPDATE job_executions
          SET status = ?, logs = ?, updated_at = ?, flow_run_id = ?
          WHERE id = ?
        `).run('running', JSON.stringify(logEntry), new Date().toISOString(), prefectRun.id, jobExecutionId)

        jobResults.push({
          jobId: job.id,
          jobName: job.name,
          status: 'running',
          flowRunId: prefectRun.id
        })

      } catch (error: any) {
        overallStatus = 'failed'
        const jobEndTime = new Date().toISOString()
        db.prepare(`
          UPDATE job_executions
          SET status = ?, completed_at = ?, duration_ms = ?, error_message = ?, updated_at = ?
          WHERE id = ?
        `).run('failed', jobEndTime, new Date(jobEndTime).getTime() - new Date(jobStartTime).getTime(), error.message, jobEndTime, jobExecutionId)

        db.prepare(`
          UPDATE executions
          SET status = ?, completed_at = ?, duration_ms = ?, updated_at = ?
          WHERE id = ?
        `).run('failed', jobEndTime, new Date(jobEndTime).getTime() - new Date(startTime).getTime(), jobEndTime, executionId)

        console.error(`❌ Failed to schedule Prefect run for job ${job.id}:`, error)

        return NextResponse.json(
          {
            success: false,
            executionId,
            status: 'failed',
            error: error.message,
            jobResults
          },
          { status: 500 }
        )
      }
    }

    db.prepare(`
      UPDATE workflows SET last_run = ?, updated_at = ? WHERE id = ?
    `).run(startTime, new Date().toISOString(), workflowId)

    db.prepare(`
      UPDATE executions
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(overallStatus, new Date().toISOString(), executionId)

    return NextResponse.json({
      success: true,
      executionId,
      status: overallStatus,
      jobResults
    })

  } catch (error: any) {
    console.error('❌ Workflow execution error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to trigger workflow' },
      { status: 500 }
    )
  }
}
