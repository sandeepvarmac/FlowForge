/**
 * API Route: /api/catalog/[tableId]/status
 *
 * GET: Check dataset readiness status
 * PATCH: Update dataset status (called by Prefect after completion)
 *
 * Used for layer-centric mode dependency tracking.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { DatasetStatus } from '@/types/pipeline'

interface CatalogEntry {
  id: string
  layer: string
  table_name: string
  environment: string
  dataset_status: DatasetStatus
  last_execution_id: string | null
  file_path: string | null
  row_count: number
  updated_at: number
}

/**
 * GET /api/catalog/[tableId]/status
 * Returns the current status of a dataset in the catalog
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params
    const db = getDatabase()

    // tableId can be either the catalog ID or the table_name
    const query = `
      SELECT
        id, layer, table_name, environment,
        dataset_status, last_execution_id, file_path, row_count, updated_at
      FROM metadata_catalog
      WHERE id = ? OR table_name = ?
      LIMIT 1
    `

    const entry = db.prepare(query).get(tableId, tableId) as CatalogEntry | undefined

    if (!entry) {
      return NextResponse.json(
        { error: 'Dataset not found in catalog' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: entry.id,
      tableName: entry.table_name,
      layer: entry.layer,
      environment: entry.environment,
      status: entry.dataset_status || 'ready', // Default to 'ready' for backward compatibility
      lastExecutionId: entry.last_execution_id,
      filePath: entry.file_path,
      rowCount: entry.row_count,
      updatedAt: entry.updated_at,
      isReady: (entry.dataset_status || 'ready') === 'ready',
    })
  } catch (error: any) {
    console.error('Error fetching dataset status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dataset status', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/catalog/[tableId]/status
 * Updates the status of a dataset (called by Prefect after job completion)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { tableId: string } }
) {
  try {
    const { tableId } = params
    const body = await request.json()
    const db = getDatabase()

    // Validate status
    const validStatuses: DatasetStatus[] = ['pending', 'running', 'ready', 'failed']
    if (body.status && !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if entry exists (by ID or table_name)
    const existingEntry = db.prepare(
      'SELECT id FROM metadata_catalog WHERE id = ? OR table_name = ? LIMIT 1'
    ).get(tableId, tableId) as { id: string } | undefined

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Dataset not found in catalog' },
        { status: 404 }
      )
    }

    // Build update query
    const updates: string[] = []
    const updateParams: any[] = []

    if (body.status) {
      updates.push('dataset_status = ?')
      updateParams.push(body.status)
    }

    if (body.executionId) {
      updates.push('last_execution_id = ?')
      updateParams.push(body.executionId)
    }

    if (body.rowCount !== undefined) {
      updates.push('row_count = ?')
      updateParams.push(body.rowCount)
    }

    if (body.filePath) {
      updates.push('file_path = ?')
      updateParams.push(body.filePath)
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    updateParams.push(Date.now())
    updateParams.push(existingEntry.id)

    const updateQuery = `
      UPDATE metadata_catalog
      SET ${updates.join(', ')}
      WHERE id = ?
    `

    db.prepare(updateQuery).run(...updateParams)

    // Return updated entry
    const updatedEntry = db.prepare(
      'SELECT id, table_name, layer, environment, dataset_status, last_execution_id, updated_at FROM metadata_catalog WHERE id = ?'
    ).get(existingEntry.id) as CatalogEntry

    return NextResponse.json({
      success: true,
      id: updatedEntry.id,
      tableName: updatedEntry.table_name,
      layer: updatedEntry.layer,
      status: updatedEntry.dataset_status,
      lastExecutionId: updatedEntry.last_execution_id,
      updatedAt: updatedEntry.updated_at,
    })
  } catch (error: any) {
    console.error('Error updating dataset status:', error)
    return NextResponse.json(
      { error: 'Failed to update dataset status', details: error.message },
      { status: 500 }
    )
  }
}
