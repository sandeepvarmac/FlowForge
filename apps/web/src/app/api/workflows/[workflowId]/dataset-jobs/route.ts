/**
 * API Route: /api/workflows/[workflowId]/dataset-jobs
 *
 * POST: Create a new Dataset Job (layer-centric mode)
 * GET: List all Dataset Jobs for a pipeline
 *
 * Dataset Jobs are special sources that:
 * - Reference datasets from the catalog as inputs
 * - Use SQL transforms with DuckDB
 * - Target Silver or Gold layers
 * - Support cross-source joins
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { TargetLayer } from '@/types/pipeline'

interface CreateDatasetJobRequest {
  name: string
  description?: string
  targetLayer: TargetLayer
  inputDatasets: string[]
  transformSql: string
  outputTableName: string
}

/**
 * POST /api/workflows/[workflowId]/dataset-jobs
 * Create a new Dataset Job
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const body: CreateDatasetJobRequest = await request.json()
    const db = getDatabase()

    // Validate required fields
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Job name is required' },
        { status: 400 }
      )
    }

    if (!body.inputDatasets || body.inputDatasets.length === 0) {
      return NextResponse.json(
        { error: 'At least one input dataset is required' },
        { status: 400 }
      )
    }

    if (!body.transformSql?.trim()) {
      return NextResponse.json(
        { error: 'SQL transform is required' },
        { status: 400 }
      )
    }

    if (!body.outputTableName?.trim()) {
      return NextResponse.json(
        { error: 'Output table name is required' },
        { status: 400 }
      )
    }

    // Verify pipeline exists and is layer-centric
    const pipeline = db.prepare(
      'SELECT id, name, pipeline_mode FROM pipelines WHERE id = ?'
    ).get(workflowId) as { id: string; name: string; pipeline_mode: string } | undefined

    if (!pipeline) {
      return NextResponse.json(
        { error: 'Pipeline not found' },
        { status: 404 }
      )
    }

    // Get max order_index for this pipeline
    const maxOrder = db.prepare(
      'SELECT MAX(order_index) as max_order FROM sources WHERE pipeline_id = ?'
    ).get(workflowId) as { max_order: number | null }

    const orderIndex = (maxOrder?.max_order ?? -1) + 1

    const now = Date.now()
    const id = `dj_${now}_${Math.random().toString(36).substring(7)}`

    // Create the Dataset Job as a special source
    db.prepare(`
      INSERT INTO sources (
        id, pipeline_id, name, description, type, order_index, status,
        source_config, destination_config,
        is_dataset_job, target_layer, input_datasets, transform_sql,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      workflowId,
      body.name,
      body.description || null,
      'file-based', // use allowed type; flagged as dataset job via is_dataset_job
      orderIndex,
      'configured',
      // Source config - minimal for Dataset Jobs
      JSON.stringify({
        id: id,
        name: body.name,
        type: 'dataset-job',
        connection: {}
      }),
      // Destination config - focused on target layer
      JSON.stringify({
        bronzeConfig: { enabled: false, tableName: '' },
        silverConfig: body.targetLayer === 'silver' ? {
          enabled: true,
          tableName: body.outputTableName,
          storageFormat: 'parquet'
        } : { enabled: false, tableName: '' },
        goldConfig: body.targetLayer === 'gold' ? {
          enabled: true,
          tableName: body.outputTableName,
          storageFormat: 'parquet'
        } : { enabled: false, tableName: '' }
      }),
      1, // is_dataset_job = true
      body.targetLayer,
      JSON.stringify(body.inputDatasets),
      body.transformSql,
      now,
      now
    )

    console.log(`✅ Created Dataset Job: ${body.name} (${id}) for pipeline ${workflowId}`)

    return NextResponse.json({
      success: true,
      job: {
        id,
        pipelineId: workflowId,
        name: body.name,
        description: body.description,
        type: 'dataset-job',
        targetLayer: body.targetLayer,
        inputDatasets: body.inputDatasets,
        transformSql: body.transformSql,
        outputTableName: body.outputTableName,
        status: 'configured',
        createdAt: now,
        updatedAt: now
      }
    })

  } catch (error: any) {
    console.error('❌ Error creating Dataset Job:', error)
    return NextResponse.json(
      { error: 'Failed to create Dataset Job', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workflows/[workflowId]/dataset-jobs
 * List all Dataset Jobs for a pipeline
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    const jobs = db.prepare(`
      SELECT
        id, pipeline_id, name, description, type, order_index, status,
        target_layer, input_datasets, transform_sql,
        destination_config,
        created_at, updated_at
      FROM sources
      WHERE pipeline_id = ? AND is_dataset_job = 1
      ORDER BY order_index
    `).all(workflowId) as any[]

    const result = jobs.map(job => {
      const destConfig = job.destination_config ? JSON.parse(job.destination_config) : {}

      // Determine output table name from destination config
      let outputTableName = ''
      if (job.target_layer === 'silver' && destConfig.silverConfig?.tableName) {
        outputTableName = destConfig.silverConfig.tableName
      } else if (job.target_layer === 'gold' && destConfig.goldConfig?.tableName) {
        outputTableName = destConfig.goldConfig.tableName
      }

      return {
        id: job.id,
        pipelineId: job.pipeline_id,
        name: job.name,
        description: job.description,
        type: job.type,
        status: job.status,
        targetLayer: job.target_layer,
        inputDatasets: job.input_datasets ? JSON.parse(job.input_datasets) : [],
        transformSql: job.transform_sql,
        outputTableName,
        orderIndex: job.order_index,
        createdAt: job.created_at,
        updatedAt: job.updated_at
      }
    })

    return NextResponse.json({
      count: result.length,
      jobs: result
    })

  } catch (error: any) {
    console.error('❌ Error listing Dataset Jobs:', error)
    return NextResponse.json(
      { error: 'Failed to list Dataset Jobs', details: error.message },
      { status: 500 }
    )
  }
}
