import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

const PREFECT_API_URL = (process.env.PREFECT_API_URL || 'http://127.0.0.1:4200/api').replace(/\/$/, '')
const PREFECT_FLOW_NAME = process.env.PREFECT_FLOW_NAME || 'flowforge-medallion'
const PREFECT_DEPLOYMENT_NAME = process.env.PREFECT_DEPLOYMENT_NAME || 'customer-data'

interface PrefectRunResponse {
  id: string
  name?: string
}

async function triggerPrefectRun(
  flowName: string,
  deploymentName: string,
  parameters: Record<string, unknown>
): Promise<PrefectRunResponse> {
  const url = `${PREFECT_API_URL}/deployments/name/${encodeURIComponent(flowName)}/${encodeURIComponent(deploymentName)}/create_flow_run`
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

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/jobs/[jobId]/execute
 * Trigger a Prefect medallion run for a single job.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    const db = getDatabase()
    const jobRow = db.prepare(`SELECT * FROM sources WHERE id = ?`).get(jobId) as any
    const pipelineRow = db.prepare(`SELECT * FROM pipelines WHERE id = ?`).get(jobRow?.pipeline_id) as any

    if (!jobRow) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const sourceConfig = typeof jobRow.source_config === 'string' ? JSON.parse(jobRow.source_config) : jobRow.source_config
    const destinationConfig = typeof jobRow.destination_config === 'string' ? JSON.parse(jobRow.destination_config) : jobRow.destination_config

    const landingKey =
      sourceConfig?.landingKey ||
      `landing/${jobRow.pipeline_id}/${jobRow.id}/${sourceConfig?.fileConfig?.filePath || ''}`

    // Map source type to medallion parameter
    const sourceType = jobRow.type === 'database' ? 'database' : 'file'

    // File options (used for file-based jobs)
    const fileFormat = sourceConfig?.type || 'csv'
    const fileOptions = sourceConfig?.fileConfig || {}
    const hasHeader = sourceConfig?.fileConfig?.hasHeader ?? true

    const workflowName = pipelineRow?.name || jobRow.pipeline_id
    const jobName = jobRow?.name || jobRow.id
    const environment = pipelineRow?.environment || 'prod'
    const prefectConfig = sourceConfig?.prefect ?? {}
    const [flowName, deploymentName] = (prefectConfig.deploymentName || `${PREFECT_FLOW_NAME}/${PREFECT_DEPLOYMENT_NAME}`).split('/')
    const primaryKeys = prefectConfig.parameters?.primary_keys || []

    const prefectRun = await triggerPrefectRun(flowName, deploymentName, {
      workflow_id: jobRow.pipeline_id,
      job_id: jobId,
      workflow_name: workflowName,
      job_name: jobName,
      source_type: sourceType,
      landing_key: landingKey,
      primary_keys: primaryKeys,
      source_config: sourceConfig,
      destination_config: destinationConfig,
      file_format: fileFormat,
      file_options: fileOptions,
      has_header: hasHeader,
      environment
    })

    return NextResponse.json({
      success: true,
      jobId,
      flowRunId: prefectRun.id,
      landingKey,
      primaryKeys
    })

  } catch (error: any) {
    console.error('❌ Job execution error:', error)
    return NextResponse.json(
      { error: error.message || 'Execution failed' },
      { status: 500 }
    )
  }
}
