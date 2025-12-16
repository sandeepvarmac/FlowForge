/**
 * API Route: POST /api/catalog/resolve
 *
 * Resolves multiple dataset names to their S3 paths and metadata.
 * Used by layer-centric Dataset Jobs to resolve input datasets.
 *
 * Input: { datasets: ["bronze_customers", "bronze_orders"], environment?: "prod" }
 * Output: { datasets: [{ name, layer, path, schema, rowCount, status }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { DatasetStatus, TargetLayer } from '@/types/pipeline'

interface ResolvedDataset {
  name: string
  layer: TargetLayer
  catalogId: string
  path: string | null
  schema: any[]
  rowCount: number
  fileSize: number
  status: DatasetStatus
  isReady: boolean
  environment: string
  updatedAt: number
}

interface ResolveRequest {
  datasets: string[] // Array of table names to resolve
  environment?: string // Optional environment filter (defaults to 'prod')
  layer?: TargetLayer // Optional layer filter
  requireReady?: boolean // If true, returns error if any dataset is not ready
}

export async function POST(request: NextRequest) {
  try {
    const body: ResolveRequest = await request.json()

    if (!body.datasets || !Array.isArray(body.datasets) || body.datasets.length === 0) {
      return NextResponse.json(
        { error: 'datasets array is required and must not be empty' },
        { status: 400 }
      )
    }

    const environment = body.environment || 'prod'
    const requireReady = body.requireReady ?? false
    const db = getDatabase()

    // Build query to fetch all requested datasets
    const placeholders = body.datasets.map(() => '?').join(', ')
    let query = `
      SELECT
        id, layer, table_name, environment,
        file_path, schema, row_count, file_size,
        dataset_status, updated_at
      FROM metadata_catalog
      WHERE table_name IN (${placeholders})
        AND environment = ?
    `
    const params: any[] = [...body.datasets, environment]

    // Optional layer filter
    if (body.layer) {
      query += ' AND layer = ?'
      params.push(body.layer)
    }

    const entries = db.prepare(query).all(...params) as any[]

    // Map results by table name for easy lookup
    const resolvedMap = new Map<string, ResolvedDataset>()

    entries.forEach((entry) => {
      const status = (entry.dataset_status || 'ready') as DatasetStatus
      resolvedMap.set(entry.table_name, {
        name: entry.table_name,
        layer: entry.layer as TargetLayer,
        catalogId: entry.id,
        path: entry.file_path,
        schema: entry.schema ? JSON.parse(entry.schema) : [],
        rowCount: entry.row_count || 0,
        fileSize: entry.file_size || 0,
        status,
        isReady: status === 'ready',
        environment: entry.environment,
        updatedAt: entry.updated_at,
      })
    })

    // Build results array in the same order as requested
    const resolved: ResolvedDataset[] = []
    const notFound: string[] = []
    const notReady: string[] = []

    body.datasets.forEach((datasetName) => {
      const dataset = resolvedMap.get(datasetName)
      if (!dataset) {
        notFound.push(datasetName)
      } else {
        resolved.push(dataset)
        if (requireReady && !dataset.isReady) {
          notReady.push(datasetName)
        }
      }
    })

    // Check for errors
    if (notFound.length > 0) {
      return NextResponse.json(
        {
          error: 'Some datasets were not found in the catalog',
          notFound,
          resolved,
        },
        { status: 404 }
      )
    }

    if (requireReady && notReady.length > 0) {
      return NextResponse.json(
        {
          error: 'Some datasets are not ready',
          notReady,
          resolved,
        },
        { status: 409 } // Conflict - datasets exist but are not ready
      )
    }

    // All datasets found and ready (if required)
    return NextResponse.json({
      success: true,
      count: resolved.length,
      datasets: resolved,
      allReady: resolved.every((d) => d.isReady),
    })
  } catch (error: any) {
    console.error('Error resolving datasets:', error)
    return NextResponse.json(
      { error: 'Failed to resolve datasets', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/catalog/resolve
 * Returns available datasets that can be used as inputs for Dataset Jobs
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const environment = searchParams.get('environment') || 'prod'
    const layer = searchParams.get('layer') as TargetLayer | null
    const statusFilter = searchParams.get('status') as DatasetStatus | null
    const search = searchParams.get('search') || ''

    const db = getDatabase()

    let query = `
      SELECT
        mc.id, mc.layer, mc.table_name, mc.environment,
        mc.file_path, mc.schema, mc.row_count, mc.file_size,
        mc.dataset_status, mc.updated_at,
        s.name as source_name,
        p.name as pipeline_name
      FROM metadata_catalog mc
      LEFT JOIN sources s ON mc.source_id = s.id
      LEFT JOIN pipelines p ON s.pipeline_id = p.id
      WHERE mc.environment = ?
    `
    const params: any[] = [environment]

    if (layer) {
      query += ' AND mc.layer = ?'
      params.push(layer)
    }

    if (statusFilter) {
      query += ' AND mc.dataset_status = ?'
      params.push(statusFilter)
    }

    if (search) {
      query += ' AND mc.table_name LIKE ?'
      params.push(`%${search}%`)
    }

    query += ' ORDER BY mc.layer, mc.table_name'

    const entries = db.prepare(query).all(...params) as any[]

    const datasets = entries.map((entry) => {
      const status = (entry.dataset_status || 'ready') as DatasetStatus
      return {
        name: entry.table_name,
        layer: entry.layer as TargetLayer,
        catalogId: entry.id,
        path: entry.file_path,
        schema: entry.schema ? JSON.parse(entry.schema) : [],
        rowCount: entry.row_count || 0,
        fileSize: entry.file_size || 0,
        status,
        isReady: status === 'ready',
        environment: entry.environment,
        sourceName: entry.source_name,
        pipelineName: entry.pipeline_name,
        updatedAt: entry.updated_at,
      }
    })

    // Group by layer for convenience
    const byLayer = {
      bronze: datasets.filter((d) => d.layer === 'bronze'),
      silver: datasets.filter((d) => d.layer === 'silver'),
      gold: datasets.filter((d) => d.layer === 'gold'),
    }

    return NextResponse.json({
      count: datasets.length,
      datasets,
      byLayer,
      filters: {
        environment,
        layer,
        status: statusFilter,
        search,
      },
    })
  } catch (error: any) {
    console.error('Error listing datasets:', error)
    return NextResponse.json(
      { error: 'Failed to list datasets', details: error.message },
      { status: 500 }
    )
  }
}
