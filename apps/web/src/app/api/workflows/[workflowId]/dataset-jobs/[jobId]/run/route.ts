/**
 * API Route: POST /api/workflows/[workflowId]/dataset-jobs/[jobId]/run
 *
 * Executes a Dataset Job by triggering the Prefect flow.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

// Prefect API configuration
const PREFECT_API_URL = process.env.PREFECT_API_URL || 'http://localhost:4200/api'

interface DatasetJobRow {
  id: string
  pipeline_id: string
  name: string
  target_layer: string
  input_datasets: string | null
  transform_sql: string | null
  destination_config: string | null
  status: string
}

/**
 * POST /api/workflows/[workflowId]/dataset-jobs/[jobId]/run
 * Execute a Dataset Job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string; jobId: string } }
) {
  try {
    const { workflowId, jobId } = params
    const db = getDatabase()

    // Get the Dataset Job
    const job = db.prepare(`
      SELECT
        id, pipeline_id, name, target_layer,
        input_datasets, transform_sql, destination_config, status
      FROM sources
      WHERE id = ? AND pipeline_id = ? AND is_dataset_job = 1
    `).get(jobId, workflowId) as DatasetJobRow | undefined

    if (!job) {
      return NextResponse.json(
        { error: 'Dataset Job not found' },
        { status: 404 }
      )
    }

    // Parse input datasets
    const inputDatasets = job.input_datasets ? JSON.parse(job.input_datasets) : []
    if (inputDatasets.length === 0) {
      return NextResponse.json(
        { error: 'Dataset Job has no input datasets configured' },
        { status: 400 }
      )
    }

    // Parse destination config to get output table name
    const destConfig = job.destination_config ? JSON.parse(job.destination_config) : {}
    let outputTableName = ''

    if (job.target_layer === 'silver' && destConfig.silverConfig?.tableName) {
      outputTableName = destConfig.silverConfig.tableName
    } else if (job.target_layer === 'gold' && destConfig.goldConfig?.tableName) {
      outputTableName = destConfig.goldConfig.tableName
    }

    if (!outputTableName) {
      return NextResponse.json(
        { error: 'Dataset Job has no output table name configured' },
        { status: 400 }
      )
    }

    // Generate execution ID
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`

    // Try to trigger Prefect deployment
    let prefectResponse = null
    let prefectError = null

    try {
      // Get the deployment ID for dataset-job flow
      const deploymentsResponse = await fetch(`${PREFECT_API_URL}/deployments/filter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deployments: {
            name: { any_: ['flowforge-dataset-job'] }
          }
        })
      })

      if (deploymentsResponse.ok) {
        const deployments = await deploymentsResponse.json()

        if (deployments && deployments.length > 0) {
          const deploymentId = deployments[0].id

          // Trigger the deployment
          const runResponse = await fetch(
            `${PREFECT_API_URL}/deployments/${deploymentId}/create_flow_run`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parameters: {
                  job_id: job.id,
                  job_name: job.name,
                  target_layer: job.target_layer,
                  input_datasets: inputDatasets,
                  transform_sql: job.transform_sql,
                  output_table_name: outputTableName,
                  execution_id: executionId,
                  environment: 'dev', // TODO: Get from pipeline config
                  layer_config: job.target_layer === 'gold' ? destConfig.goldConfig : destConfig.silverConfig
                }
              })
            }
          )

          if (runResponse.ok) {
            prefectResponse = await runResponse.json()
          } else {
            prefectError = `Prefect run creation failed: ${runResponse.status}`
          }
        } else {
          prefectError = 'Dataset Job deployment not found in Prefect'
        }
      } else {
        prefectError = `Failed to fetch Prefect deployments: ${deploymentsResponse.status}`
      }
    } catch (error: any) {
      prefectError = `Prefect API error: ${error.message}`
      console.warn('Prefect API not available, execution will be recorded only')
    }

    // Update job status
    const now = Date.now()
    db.prepare(`
      UPDATE sources
      SET status = 'running', updated_at = ?
      WHERE id = ?
    `).run(now, jobId)

    // Create execution record
    db.prepare(`
      INSERT INTO executions (
        id, pipeline_id, status, triggered_by, started_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      executionId,
      workflowId,
      'running',
      'manual',
      now,
      now,
      now
    )

    // Create source execution record
    const sourceExecId = `se_${Date.now()}_${Math.random().toString(36).substring(7)}`
    db.prepare(`
      INSERT INTO source_executions (
        id, execution_id, source_id, status, started_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      sourceExecId,
      executionId,
      jobId,
      'running',
      now,
      now,
      now
    )

    console.log(`✅ Started Dataset Job execution: ${job.name} (${executionId})`)

    return NextResponse.json({
      success: true,
      executionId,
      jobId,
      jobName: job.name,
      targetLayer: job.target_layer,
      inputDatasets,
      outputTableName,
      prefect: prefectResponse ? {
        flowRunId: prefectResponse.id,
        state: prefectResponse.state?.type || 'PENDING'
      } : null,
      warning: prefectError || undefined
    })

  } catch (error: any) {
    console.error('❌ Error executing Dataset Job:', error)
    return NextResponse.json(
      { error: 'Failed to execute Dataset Job', details: error.message },
      { status: 500 }
    )
  }
}
