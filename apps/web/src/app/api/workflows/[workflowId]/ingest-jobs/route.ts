/**
 * API Route: /api/workflows/[workflowId]/ingest-jobs
 *
 * POST: Create a new Ingest Job (Landing -> Bronze)
 * GET: List all Ingest Jobs for a pipeline
 *
 * Ingest Jobs are layer-centric jobs that:
 * - Ingest files (CSV/Parquet/JSON) from uploads or S3
 * - Write directly to Bronze layer
 * - Register in metadata catalog
 * - Support schema detection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { featureFlags } from '@/lib/config/feature-flags'

interface IngestJobOptions {
  delimiter?: string
  header?: boolean
  encoding?: string
  dateColumns?: string[]
  quoteChar?: string
  skipRows?: number
}

interface CreateIngestJobRequest {
  name: string
  description?: string
  sourceType: 'upload' | 's3' | 'local'
  sourcePath?: string
  fileFormat: 'csv' | 'parquet' | 'json'
  options?: IngestJobOptions
  targetTable: string
  environment?: 'dev' | 'qa' | 'uat' | 'prod'
  detectedSchema?: Record<string, any>
}

/**
 * POST /api/workflows/[workflowId]/ingest-jobs
 * Create a new Ingest Job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    // Check feature flag
    if (!featureFlags.showLayerCentricMode) {
      return NextResponse.json(
        { error: 'Layer-centric mode is not enabled' },
        { status: 403 }
      )
    }

    const { workflowId } = params
    const body: CreateIngestJobRequest = await request.json()
    const db = getDatabase()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Job name is required' },
        { status: 400 }
      )
    }

    if (!body.fileFormat) {
      return NextResponse.json(
        { error: 'File format is required' },
        { status: 400 }
      )
    }

    if (!body.targetTable?.trim()) {
      return NextResponse.json(
        { error: 'Target table name is required' },
        { status: 400 }
      )
    }

    // Verify pipeline exists
    const pipeline = db.prepare(
      'SELECT id, name, pipeline_mode FROM pipelines WHERE id = ?'
    ).get(workflowId) as { id: string; name: string; pipeline_mode: string } | undefined

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    // Check if pipeline is layer-centric mode
    if (pipeline.pipeline_mode !== 'layer-centric') {
      return NextResponse.json(
        { error: 'Ingest Jobs are only available for layer-centric pipelines' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const id = `ij_${now}_${Math.random().toString(36).substring(7)}`

    // Default options for CSV files
    const defaultOptions: IngestJobOptions = {
      delimiter: ',',
      header: true,
      encoding: 'utf-8',
      dateColumns: [],
      quoteChar: '"'
    }

    const options = body.options ? { ...defaultOptions, ...body.options } : defaultOptions

    // Create the Ingest Job
    db.prepare(`
      INSERT INTO layer_centric_ingest_jobs (
        id, pipeline_id, name, description,
        source_type, source_path, file_format, options,
        target_table, environment, detected_schema,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workflowId,
      body.name,
      body.description || null,
      body.sourceType,
      body.sourcePath || null,
      body.fileFormat,
      JSON.stringify(options),
      body.targetTable,
      body.environment || 'dev',
      body.detectedSchema ? JSON.stringify(body.detectedSchema) : null,
      'configured',
      now,
      now
    )

    console.log(`✅ Created Ingest Job: ${body.name} (${id}) for pipeline ${workflowId}`)

    return NextResponse.json({
      success: true,
      job: {
        id,
        pipelineId: workflowId,
        name: body.name,
        description: body.description,
        sourceType: body.sourceType,
        sourcePath: body.sourcePath,
        fileFormat: body.fileFormat,
        options,
        targetTable: body.targetTable,
        environment: body.environment || 'dev',
        detectedSchema: body.detectedSchema,
        status: 'configured',
        createdAt: now,
        updatedAt: now
      }
    })

  } catch (error: any) {
    console.error('❌ Error creating Ingest Job:', error)
    return NextResponse.json(
      { error: 'Failed to create Ingest Job', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflows/[workflowId]/ingest-jobs
 * List all Ingest Jobs for a pipeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    // Check feature flag
    if (!featureFlags.showLayerCentricMode) {
      return NextResponse.json(
        { error: 'Layer-centric mode is not enabled' },
        { status: 403 }
      )
    }

    const { workflowId } = params
    const db = getDatabase()

    // Verify pipeline exists and is layer-centric
    const pipeline = db.prepare(
      'SELECT id, pipeline_mode FROM pipelines WHERE id = ?'
    ).get(workflowId) as { id: string; pipeline_mode: string } | undefined

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    // For non-layer-centric pipelines, return empty list (they don't have ingest jobs)
    if (pipeline.pipeline_mode !== 'layer-centric') {
      return NextResponse.json({
        count: 0,
        jobs: []
      })
    }

    // Get ingest jobs with their latest run info
    const jobs = db.prepare(`
      SELECT
        j.*,
        (
          SELECT json_object(
            'id', r.id,
            'status', r.status,
            'rowCount', r.row_count,
            'startedAt', r.started_at,
            'finishedAt', r.finished_at,
            'durationMs', r.duration_ms,
            'outputKey', r.output_key,
            'errorMessage', r.error_message
          )
          FROM layer_centric_ingest_runs r
          WHERE r.job_id = j.id
          ORDER BY r.created_at DESC
          LIMIT 1
        ) as latest_run
      FROM layer_centric_ingest_jobs j
      WHERE j.pipeline_id = ?
      ORDER BY j.created_at DESC
    `).all(workflowId) as any[]

    const result = jobs.map(job => ({
      id: job.id,
      pipelineId: job.pipeline_id,
      name: job.name,
      description: job.description,
      sourceType: job.source_type,
      sourcePath: job.source_path,
      fileFormat: job.file_format,
      options: job.options ? JSON.parse(job.options) : {},
      targetTable: job.target_table,
      environment: job.environment,
      detectedSchema: job.detected_schema ? JSON.parse(job.detected_schema) : null,
      status: job.status,
      latestRun: job.latest_run ? JSON.parse(job.latest_run) : null,
      createdAt: job.created_at,
      updatedAt: job.updated_at
    }))

    return NextResponse.json({
      count: result.length,
      jobs: result
    })

  } catch (error: any) {
    console.error('❌ Error listing Ingest Jobs:', error)
    return NextResponse.json(
      { error: 'Failed to list Ingest Jobs', details: error.message },
      { status: 500 }
    )
  }
}
