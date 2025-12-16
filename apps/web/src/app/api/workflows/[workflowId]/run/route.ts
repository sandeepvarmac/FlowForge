import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { listFiles, generateLandingKey } from '@/lib/storage'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import path from 'path'
import fs from 'fs'

const PREFECT_API_URL = (process.env.PREFECT_API_URL || 'http://127.0.0.1:4200/api').replace(/\/$/, '')
const WORKER_LOCALHOST_ALIAS = process.env.WORKER_LOCALHOST_ALIAS || 'host.docker.internal'

// Legacy deployment ID (fallback)
const PREFECT_DEPLOYMENT_ID = process.env.PREFECT_DEPLOYMENT_ID || '6418e5a3-9205-4fa6-a5fe-6e852c32281a'

// Environment-based deployment IDs
const DEPLOYMENT_IDS = {
  production: process.env.PREFECT_DEPLOYMENT_ID_PRODUCTION,
  uat: process.env.PREFECT_DEPLOYMENT_ID_UAT,
  qa: process.env.PREFECT_DEPLOYMENT_ID_QA,
  development: process.env.PREFECT_DEPLOYMENT_ID_DEVELOPMENT,
}

const LOCAL_HOST_VALUES = new Set(['localhost', '127.0.0.1', '::1'])

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

/**
 * Try to trigger a Prefect deployment for a layer-centric pipeline.
 * Returns the flow run ID if dispatched, otherwise null.
 */
async function triggerLayerCentricPrefectPipeline(pipelineId: string): Promise<string | null> {
  try {
    const deploymentsResponse = await fetch(`${PREFECT_API_URL}/deployments/filter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deployments: { name: { any_: ['layer-centric-pipeline'] } },
        limit: 1,
      }),
    })

    if (!deploymentsResponse.ok) {
      console.warn('⚠️ Could not reach Prefect API for layer-centric pipeline deployment')
      return null
    }

    const deployments = await deploymentsResponse.json()
    if (!deployments || deployments.length === 0) {
      console.warn('⚠️ No layer-centric-pipeline deployment found')
      return null
    }

    const deploymentId = deployments[0].id
    const flowRunResponse = await fetch(`${PREFECT_API_URL}/deployments/${deploymentId}/create_flow_run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `layer-centric-${pipelineId}-${Date.now()}`,
        parameters: { pipeline_id: pipelineId },
      }),
    })

    if (!flowRunResponse.ok) {
      const detail = await flowRunResponse.text()
      console.error('❌ Prefect layer-centric flow run creation failed:', detail)
      return null
    }

    const flowRun = await flowRunResponse.json()
    console.log(`✅ Triggered Prefect layer-centric pipeline run: ${flowRun.id}`)
    return flowRun.id
  } catch (error: any) {
    console.warn('⚠️ Prefect layer-centric trigger error:', error?.message || error)
    return null
  }
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
  { params }: { params: Promise<{ workflowId: string }> }
) {
  try {
    const { workflowId } = await params
    const db = getDatabase()

    const workflow = db.prepare(`
      SELECT * FROM pipelines WHERE id = ?
    `).get(workflowId) as any

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // ----------------------------------------------------------------------
    // Layer-Centric pipeline execution: orchestrate ingest -> dataset jobs
    // ----------------------------------------------------------------------
    if (workflow.pipeline_mode === 'layer-centric') {
      const startTime = Date.now()
      const executionId = `exec_${startTime}_${Math.random().toString(36).slice(2, 9)}`
      const workflowEnv = (workflow.environment || 'production').toString().toLowerCase()

      // Create execution record
      db.prepare(`
        INSERT INTO executions (id, pipeline_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(executionId, workflowId, 'running', startTime, startTime, startTime)

      // First try Prefect deployment; fallback to inline if not available
      const prefectFlowRunId = await triggerLayerCentricPrefectPipeline(workflowId)
      if (prefectFlowRunId) {
        db.prepare(`
          UPDATE executions
          SET status = ?, updated_at = ?, flow_run_id = ?
          WHERE id = ?
        `).run('running', Date.now(), prefectFlowRunId, executionId)

        return NextResponse.json({
          success: true,
          executionId,
          status: 'running',
          prefectFlowRunId,
          message: 'Layer-centric pipeline triggered via Prefect',
        })
      }

      // If Prefect is required (production), fail fast rather than inline
      if (workflowEnv in { production: true, prod: true }) {
        db.prepare(`
          UPDATE executions
          SET status = ?, completed_at = ?, updated_at = ?
          WHERE id = ?
        `).run('failed', Date.now(), Date.now(), executionId)

        return NextResponse.json(
          {
            success: false,
            executionId,
            status: 'failed',
            error: 'Prefect deployment layer-centric-pipeline not available in production',
          },
          { status: 503 }
        )
      }

      const origin = new URL(request.url).origin
      const jobResults: Array<Record<string, unknown>> = []
      let overallStatus: 'running' | 'failed' | 'completed' = 'running'

      // Run ingest jobs (Landing -> Bronze) sequentially
      const ingestJobs = db.prepare(`
        SELECT id, name FROM layer_centric_ingest_jobs
        WHERE pipeline_id = ?
        ORDER BY created_at ASC
      `).all(workflowId) as Array<{ id: string; name: string }>

      for (const job of ingestJobs) {
        const resp = await fetch(
          `${origin}/api/workflows/${workflowId}/ingest-jobs/${job.id}/run`,
          { method: 'POST' }
        )
        const body = await resp.json()
        jobResults.push({
          type: 'ingest',
          jobId: job.id,
          jobName: job.name,
          status: resp.ok ? 'started' : 'failed',
          details: body,
        })
        if (!resp.ok) {
          overallStatus = 'failed'
          break
        }
      }

      // Run dataset jobs (Silver/Gold) only if ingest succeeded
      if (overallStatus !== 'failed') {
        const datasetJobs = db.prepare(`
          SELECT id, name FROM sources
          WHERE pipeline_id = ? AND is_dataset_job = 1
          ORDER BY created_at ASC
        `).all(workflowId) as Array<{ id: string; name: string }>

        for (const job of datasetJobs) {
          const resp = await fetch(
            `${origin}/api/workflows/${workflowId}/dataset-jobs/${job.id}/run`,
            { method: 'POST' }
          )
          const body = await resp.json()
          jobResults.push({
            type: 'dataset',
            jobId: job.id,
            jobName: job.name,
            status: resp.ok ? 'started' : 'failed',
            details: body,
          })
          if (!resp.ok) {
            overallStatus = 'failed'
            break
          }
        }
      }

      const finishTime = Date.now()
      const finalStatus = overallStatus === 'failed' ? 'failed' : 'completed'

      db.prepare(`
        UPDATE executions
        SET status = ?, completed_at = ?, duration_ms = ?, updated_at = ?
        WHERE id = ?
      `).run(finalStatus, finishTime, finishTime - startTime, finishTime, executionId)

      db.prepare(`
        UPDATE pipelines SET last_run = ?, updated_at = ? WHERE id = ?
      `).run(startTime, finishTime, workflowId)

      return NextResponse.json({
        success: finalStatus === 'completed',
        executionId,
        status: finalStatus,
        jobResults,
      }, { status: finalStatus === 'completed' ? 200 : 500 })
    }

    const jobs = db.prepare(`
      SELECT * FROM sources WHERE pipeline_id = ? ORDER BY order_index ASC
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
      INSERT INTO executions (id, pipeline_id, status, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(executionId, workflowId, 'running', startTime, startTime, startTime)

    const jobResults: Array<Record<string, unknown>> = []
    let overallStatus: 'running' | 'failed' = 'running'

    for (const job of jobs) {
      const jobStartTime = new Date().toISOString()
      const sourceExecutionId = `job_exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      db.prepare(`
        INSERT INTO source_executions (id, execution_id, source_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(sourceExecutionId, executionId, job.id, 'running', jobStartTime, jobStartTime, jobStartTime)

      const rawSourceConfig = typeof job.source_config === 'string' ? JSON.parse(job.source_config) : job.source_config
      const enrichedSourceConfig = enrichConnectionCredentials(rawSourceConfig, db)
      const sourceConfig = normalizeSourceConfigForWorker(enrichedSourceConfig)
      const transformationConfig = typeof job.transformation_config === 'string' ? JSON.parse(job.transformation_config) : job.transformation_config
      const destinationConfig = typeof job.destination_config === 'string' ? JSON.parse(job.destination_config) : job.destination_config
      const fileConfig = sourceConfig?.fileConfig || {}
      const uploadMode = fileConfig.uploadMode || 'single'
      const prefectConfig = sourceConfig?.prefect ?? {}

      // Use environment-based deployment ID
      const deploymentId = prefectConfig.deploymentId || getDeploymentId(workflow)

      const primaryKeys = prefectConfig.parameters?.primary_keys || []
      const columnMappings = transformationConfig?.columnMappings || null
      const hasHeader = fileConfig.hasHeader !== false  // Default to true

      try {
        // Check if this is a database source
        const sourceType = sourceConfig?.type || 'file'

        if (sourceType === 'sql-server' || sourceType === 'postgresql' || sourceType === 'mysql') {
          // Database source: call database_bronze task
          console.log(`📊 Database source detected: ${sourceType}`)

          const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
          const workflowSlug = workflow.slug || workflow.name?.toLowerCase().replace(/\s+/g, '-') || workflowId
          const jobSlug = job.slug || job.name?.toLowerCase().replace(/\s+/g, '-') || job.id
          const placeholderLandingKey = `landing/${workflowId}/${job.id}/${sourceConfig?.databaseConfig?.tableName || 'database-source'}`

          const prefectRun = await triggerPrefectRun(deploymentId, {
            workflow_id: workflowId,
            job_id: job.id,
            workflow_name: workflow.name,
            job_name: job.name,
            landing_key: placeholderLandingKey,
            column_mappings: columnMappings,
            has_header: true,
            flow_run_id: null,
            file_format: 'csv',
            file_options: null,
            primary_keys: primaryKeys,
            source_config: sourceConfig,
            destination_config: destinationConfig,
            batch_id: batchId,
            execution_id: sourceExecutionId,
            source_type: 'database',
            environment: workflowEnvironment,
          })

          console.log(`✅ Database ingestion flow run created: ${prefectRun.id}`)

          db.prepare(`
            UPDATE source_executions
            SET status = ?, logs = ?, updated_at = ?, flow_run_id = ?
            WHERE id = ?
          `).run('running', JSON.stringify([`Database ingestion started: ${sourceType}`, `Prefect flow run: ${prefectRun.id}`]), new Date().toISOString(), prefectRun.id, sourceExecutionId)

          jobResults.push({
            jobId: job.id,
            jobName: job.name,
            status: 'running',
            flowRunId: prefectRun.id,
            sourceType: sourceType
          })

          continue  // Skip to next job
        }

        // File-based source processing
        let filesToProcess: string[] = []

        // Pattern matching: Scan landing zone for matching files
        if (uploadMode === 'pattern' && fileConfig.filePattern) {
          console.log(`🔍 Pattern matching mode: scanning for ${fileConfig.filePattern}`)

          const { spawn } = require('child_process')
          const path = require('path')
          const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
          const pythonExecutable = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')

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
          let landingKey = sourceConfig?.landingKey

          // Check if this is a Storage Connection source that needs file copy
          if (!landingKey && fileConfig.storageConnectionId && fileConfig.filePath) {
            console.log(`📂 Storage Connection source detected - copying file to landing zone`)
            landingKey = await copyStorageConnectionFileToLanding(
              fileConfig.storageConnectionId,
              fileConfig.filePath,
              job.name,
              db
            )

            if (!landingKey) {
              throw new Error(`Failed to copy file from storage connection for job ${job.name}. Check the storage connection configuration.`)
            }
          }

          // If still no landing key, try to resolve from existing files
          if (!landingKey) {
            landingKey = await resolveLandingKey(
              workflowId,
              job.id,
              fileConfig.filePath,
              job.name  // Pass job name for new path pattern
            )
          }

          if (!landingKey) {
            throw new Error(`No landing file found for job ${job.name}. Upload a file before running the workflow.`)
          }

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
            flow_run_id: null,  // Will be set by Prefect
            environment: workflowEnvironment,
            destination_config: destinationConfig,  // Pass layer configurations
            execution_id: sourceExecutionId,  // Pass execution ID for completion callback
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
          UPDATE source_executions
          SET status = ?, logs = ?, updated_at = ?, flow_run_id = ?
          WHERE id = ?
        `).run('running', JSON.stringify(logEntry), new Date().toISOString(), flowRuns[0], sourceExecutionId)

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
          UPDATE source_executions
          SET status = ?, completed_at = ?, duration_ms = ?, error_message = ?, updated_at = ?
          WHERE id = ?
        `).run('failed', jobEndTime, new Date(jobEndTime).getTime() - new Date(jobStartTime).getTime(), error.message, jobEndTime, sourceExecutionId)

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
      UPDATE pipelines SET last_run = ?, updated_at = ? WHERE id = ?
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

function normalizeSourceConfigForWorker(config: any) {
  if (!config || typeof config !== 'object') return config
  const cloned = JSON.parse(JSON.stringify(config))

  if (cloned.connection?.host && typeof cloned.connection.host === 'string') {
    const lower = cloned.connection.host.toLowerCase()
    if (LOCAL_HOST_VALUES.has(lower)) {
      cloned.connection.host = WORKER_LOCALHOST_ALIAS
      console.log(
        `Normalized database host for Prefect worker: ${lower} -> ${cloned.connection.host}`
      )
    }
  }

  return cloned
}

function extractFileName(filePath?: string) {
  if (!filePath) return ''
  const parts = filePath.split(/[/\\]/)
  return parts[parts.length - 1] || ''
}

function enrichConnectionCredentials(config: any, db: ReturnType<typeof getDatabase>) {
  if (!config || typeof config !== 'object') return config
  if (!config.connection || typeof config.connection !== 'object') return config

  const cloned = JSON.parse(JSON.stringify(config))
  const connection = cloned.connection

  if (!connection.password && connection.host && connection.port && connection.database && connection.username) {
    try {
      const record = db
        .prepare(
          `
          SELECT password FROM database_connections
          WHERE host = ? AND port = ? AND database = ? AND username = ?
        `
        )
        .get(connection.host, connection.port, connection.database, connection.username) as any

      if (record?.password) {
        connection.password = record.password
        console.log(`Hydrated password for connection to ${connection.host}/${connection.database}`)
      }
    } catch (error) {
      console.warn('Failed to hydrate database password from saved connections:', error)
    }
  }

  return cloned
}

async function resolveLandingKey(workflowId: string, jobId: string, originalFilePath?: string, jobName?: string) {
  // Try new path pattern first: landing/{source_name}/...
  if (jobName) {
    const sourceName = jobName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
    const newPrefix = `landing/${sourceName}/`
    try {
      const files = await listFiles(newPrefix)
      if (files?.length) {
        const sorted = files
          .filter(file => file.key && !file.key.endsWith('/'))
          .sort(
            (a, b) =>
              new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
          )
        if (sorted.length) {
          console.log(`✅ Found landing file with new path pattern: ${sorted[0].key}`)
          return sorted[0].key
        }
      }
    } catch (error) {
      console.warn('No files found with new path pattern, trying legacy...')
    }
  }

  // Fallback to legacy path pattern: landing/{workflowId}/{jobId}/...
  const legacyPrefix = `landing/${workflowId}/${jobId}/`
  try {
    const files = await listFiles(legacyPrefix)
    if (files?.length) {
      const sorted = files
        .filter(file => file.key && !file.key.endsWith('/'))
        .sort(
          (a, b) =>
            new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime()
        )
      if (sorted.length) {
        console.log(`✅ Found landing file with legacy path pattern: ${sorted[0].key}`)
        return sorted[0].key
      }
    }
  } catch (error) {
    console.warn('Failed to resolve landing key from storage:', error)
  }

  const fallbackName = extractFileName(originalFilePath)
  if (fallbackName && jobName) {
    const sourceName = jobName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')
    return `landing/${sourceName}/${fallbackName}`
  }
  return null
}

/**
 * Copy file from Storage Connection to MinIO landing zone
 * Supports local file system and S3/MinIO storage connections
 */
async function copyStorageConnectionFileToLanding(
  storageConnectionId: string,
  filePath: string,
  sourceName: string,
  db: ReturnType<typeof getDatabase>
): Promise<string | null> {
  console.log(`📦 Copying file from Storage Connection: ${storageConnectionId}`)
  console.log(`   File path: ${filePath}`)
  console.log(`   Source name: ${sourceName}`)

  const sanitizeSourceName = (name: string) =>
    name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '')

  // Fetch storage connection config
  const connectionRow = db.prepare('SELECT * FROM storage_connections WHERE id = ?').get(storageConnectionId) as any
  if (!connectionRow) {
    console.error(`❌ Storage connection not found: ${storageConnectionId}`)
    return null
  }

  const connectionConfig = JSON.parse(connectionRow.config)
  const connectionType = connectionRow.type
  console.log(`   Connection type: ${connectionType}`)

  // Get filename from path
  const fileName = path.basename(filePath.replace(/\\/g, '/'))
  const sanitizedSourceName = sanitizeSourceName(sourceName)

  // If a matching landing file already exists, reuse the latest one instead of copying again
  try {
    const existing = await listFiles(`landing/${sanitizedSourceName}/`)
    const matching = existing
      .filter(file => file.key && file.key.endsWith(`/${fileName}`))
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
    if (matching.length > 0) {
      console.log(`   \u0192o. Reusing existing landing file: ${matching[0].key}`)
      return matching[0].key
    }
  } catch (err) {
    console.warn('   ??  Could not list landing files to check for reuse:', err)
  }

  // Generate landing key using the standard pattern
  const landingKey = generateLandingKey(sourceName, fileName)

  // Initialize S3 client for MinIO upload
  const rawEndpoint = process.env.S3_ENDPOINT_URL || 'http://localhost:9000'
  const endpointUrl = (() => {
    try {
      const parsed = new URL(rawEndpoint)
      if (parsed.hostname === 'localhost' || parsed.hostname === '::1') {
        parsed.hostname = '127.0.0.1'
      }
      return parsed.toString()
    } catch {
      return rawEndpoint
    }
  })()

  const s3Client = new S3Client({
    endpoint: endpointUrl,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || 'prefect',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || 'prefect123',
    },
    forcePathStyle: true,
  })

  const bucketName = process.env.S3_BUCKET_NAME || 'flowforge-data'

  try {
    let fileContent: Buffer

    if (connectionType === 'local') {
      // Read from local file system
      const fullPath = path.join(connectionConfig.basePath, filePath)
      console.log(`   Reading local file: ${fullPath}`)

      if (!fs.existsSync(fullPath)) {
        console.error(`❌ Local file not found: ${fullPath}`)
        return null
      }

      fileContent = fs.readFileSync(fullPath)
      console.log(`   ✅ Read ${fileContent.length} bytes from local file`)

    } else if (connectionType === 's3') {
      // Read from S3/MinIO storage connection
      console.log(`   Reading S3 file from bucket: ${connectionConfig.bucket}`)

      const { S3Client: SourceS3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')

      const sourceS3Client = new SourceS3Client({
        endpoint: connectionConfig.endpointUrl,
        region: connectionConfig.region || 'us-east-1',
        credentials: {
          accessKeyId: connectionConfig.accessKeyId,
          secretAccessKey: connectionConfig.secretAccessKey,
        },
        forcePathStyle: true,
      })

      const getCommand = new GetObjectCommand({
        Bucket: connectionConfig.bucket,
        Key: filePath,
      })

      const response = await sourceS3Client.send(getCommand)
      const chunks: Uint8Array[] = []
      for await (const chunk of response.Body as any) {
        chunks.push(chunk)
      }
      fileContent = Buffer.concat(chunks)
      console.log(`   ✅ Read ${fileContent.length} bytes from S3`)

    } else {
      console.error(`❌ Unsupported storage connection type: ${connectionType}`)
      return null
    }

    // Upload to MinIO landing zone
    console.log(`   📤 Uploading to MinIO: ${landingKey}`)

    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: landingKey,
        Body: fileContent,
        ContentType: 'application/octet-stream',
      })
    )

    console.log(`   ✅ File copied to landing zone: ${landingKey}`)
    return landingKey

  } catch (error) {
    console.error(`❌ Failed to copy file from storage connection:`, error)
    return null
  }
}
