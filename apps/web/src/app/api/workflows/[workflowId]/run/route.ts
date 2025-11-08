import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

const PREFECT_API_URL = (process.env.PREFECT_API_URL || 'http://127.0.0.1:4200/api').replace(/\/$/, '')

// Legacy deployment ID (fallback)
const PREFECT_DEPLOYMENT_ID = process.env.PREFECT_DEPLOYMENT_ID || '6418e5a3-9205-4fa6-a5fe-6e852c32281a'

// Environment-based deployment IDs
const DEPLOYMENT_IDS = {
  production: process.env.PREFECT_DEPLOYMENT_ID_PRODUCTION,
  uat: process.env.PREFECT_DEPLOYMENT_ID_UAT,
  qa: process.env.PREFECT_DEPLOYMENT_ID_QA,
  development: process.env.PREFECT_DEPLOYMENT_ID_DEVELOPMENT,
}

/**
 * Get deployment ID based on workflow environment and team
 */
function getDeploymentId(workflow: any): string {
  const environment = workflow.environment || 'production'
  const team = workflow.team

  // Try environment + team combination first (e.g., PREFECT_DEPLOYMENT_PRODUCTION_FINANCE)
  if (team) {
    const teamKey = `${environment}_${team}`.toUpperCase().replace(/-/g, '_')
    const teamDeploymentId = process.env[`PREFECT_DEPLOYMENT_${teamKey}`]

    if (teamDeploymentId) {
      console.log(`✅ Using team-based deployment: ${environment}/${team}`)
      return teamDeploymentId
    }
  }

  // Fallback to environment-only deployment
  const envDeploymentId = DEPLOYMENT_IDS[environment as keyof typeof DEPLOYMENT_IDS]
  if (envDeploymentId) {
    console.log(`✅ Using environment-based deployment: ${environment}`)
    return envDeploymentId
  }

  // Final fallback to legacy deployment
  console.warn(`⚠️  No deployment configured for ${environment}/${team || 'no-team'}, using legacy deployment`)
  return PREFECT_DEPLOYMENT_ID
}

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

    const workflowEnvironment = workflow.environment || 'production'
    const workflowTeam = workflow.team || 'shared'
    console.log(`🚀 Scheduling Prefect runs for workflow ${workflow.name} (${workflowId})`)
    console.log(`   Environment: ${workflowEnvironment}, Team: ${workflowTeam}`)

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
      const transformationConfig = typeof job.transformation_config === 'string' ? JSON.parse(job.transformation_config) : job.transformation_config
      const fileConfig = sourceConfig?.fileConfig || {}
      const uploadMode = fileConfig.uploadMode || 'single'
      const prefectConfig = sourceConfig?.prefect ?? {}

      // Use environment-based deployment ID
      const deploymentId = prefectConfig.deploymentId || getDeploymentId(workflow)

      const primaryKeys = prefectConfig.parameters?.primary_keys || []
      const columnMappings = transformationConfig?.columnMappings || null
      const hasHeader = fileConfig.hasHeader !== false  // Default to true

      try {
        let filesToProcess: string[] = []

        // Pattern matching: Scan landing zone for matching files
        if (uploadMode === 'pattern' && fileConfig.filePattern) {
          console.log(`🔍 Pattern matching mode: scanning for ${fileConfig.filePattern}`)

          const { spawn } = require('child_process')
          const path = require('path')
          const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
          const pythonExecutable = path.join(prefectFlowsDir, 'venv', 'Scripts', 'python.exe')

          // Use Python script to find matching files
          const s3Prefix = `landing/${workflowId}/${job.id}/`
          const pythonOutput = await new Promise<string>((resolve, reject) => {
            const proc = spawn(pythonExecutable, [
              '-c',
              `import json; from utils.pattern_matcher import find_matching_files; matches = find_matching_files("${s3Prefix}", "${fileConfig.filePattern}"); print(json.dumps([m["key"] for m in matches]))`
            ], {
              cwd: prefectFlowsDir,
              env: { ...process.env }
            })

            let stdout = ''
            let stderr = ''

            proc.stdout.on('data', (data: Buffer) => { stdout += data.toString() })
            proc.stderr.on('data', (data: Buffer) => { stderr += data.toString() })

            proc.on('close', (code: number) => {
              if (code !== 0) {
                reject(new Error(`Pattern matching failed: ${stderr || stdout}`))
              } else {
                resolve(stdout.trim())
              }
            })

            proc.on('error', (error: Error) => {
              reject(new Error(`Failed to run pattern matcher: ${error.message}`))
            })
          })

          filesToProcess = JSON.parse(pythonOutput)
          console.log(`✅ Found ${filesToProcess.length} files matching pattern: ${filesToProcess.join(', ')}`)

          if (filesToProcess.length === 0) {
            throw new Error(`No files found matching pattern '${fileConfig.filePattern}' in ${s3Prefix}`)
          }
        } else {
          // Single file mode: use the landingKey directly
          const landingKey = sourceConfig?.landingKey || `landing/${workflowId}/${job.id}/${fileConfig.filePath || ''}`
          filesToProcess = [landingKey]
        }

        // Process each file
        const flowRuns: string[] = []
        for (const landingKey of filesToProcess) {
          const prefectRun = await triggerPrefectRun(deploymentId, {
            workflow_id: workflowId,
            job_id: job.id,
            workflow_name: workflow.name,
            job_name: job.name,
            landing_key: landingKey,
            primary_keys: primaryKeys,
            column_mappings: columnMappings,
            has_header: hasHeader,
            flow_run_id: null  // Will be set by Prefect
          })

          flowRuns.push(prefectRun.id)
          console.log(`✅ Prefect flow run created for ${landingKey}: ${prefectRun.id}`)
        }

        const logEntry = [
          `Pattern matching mode: ${uploadMode}`,
          `Files processed: ${filesToProcess.length}`,
          `Prefect flow runs: ${flowRuns.join(', ')}`
        ]

        db.prepare(`
          UPDATE job_executions
          SET status = ?, logs = ?, updated_at = ?, flow_run_id = ?
          WHERE id = ?
        `).run('running', JSON.stringify(logEntry), new Date().toISOString(), flowRuns[0], jobExecutionId)

        jobResults.push({
          jobId: job.id,
          jobName: job.name,
          status: 'running',
          flowRunId: flowRuns[0],
          filesProcessed: filesToProcess.length,
          allFlowRuns: flowRuns
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
