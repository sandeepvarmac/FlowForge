/**
 * Source Watermark API
 *
 * Manages watermark values for incremental database loads.
 * Tracks the last processed value to enable efficient delta queries.
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

function generateId(): string {
  return `wm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

interface WatermarkRecord {
  id: string
  source_id: string
  watermark_column: string
  watermark_type: string
  current_value: string | null
  previous_value: string | null
  last_run_rows_processed: number
  total_rows_processed: number
  last_successful_run: string | null
  created_at: string
  updated_at: string
}

/**
 * GET /api/sources/[sourceId]/watermark
 *
 * Get current watermark for a source
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params
    const db = getDb()

    const watermark = db
      .prepare(`SELECT * FROM source_watermarks WHERE source_id = ?`)
      .get(sourceId) as WatermarkRecord | undefined

    if (!watermark) {
      return NextResponse.json(
        { error: 'No watermark found for this source' },
        { status: 404 }
      )
    }

    return NextResponse.json(watermark)
  } catch (error) {
    console.error('Error getting watermark:', error)
    return NextResponse.json(
      { error: 'Failed to get watermark', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/sources/[sourceId]/watermark
 *
 * Update watermark after successful incremental load
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params
    const body = await request.json()

    const {
      watermark_column,
      watermark_type,
      new_value,
      rows_processed,
    } = body

    if (!watermark_column || !watermark_type) {
      return NextResponse.json(
        { error: 'Missing required fields: watermark_column, watermark_type' },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date().toISOString()

    // Check if watermark exists
    const existing = db
      .prepare(`SELECT * FROM source_watermarks WHERE source_id = ?`)
      .get(sourceId) as WatermarkRecord | undefined

    if (existing) {
      // Update existing watermark
      db.prepare(`
        UPDATE source_watermarks
        SET watermark_column = ?,
            watermark_type = ?,
            previous_value = current_value,
            current_value = ?,
            last_run_rows_processed = ?,
            total_rows_processed = total_rows_processed + ?,
            last_successful_run = ?,
            updated_at = ?
        WHERE source_id = ?
      `).run(
        watermark_column,
        watermark_type,
        new_value || null,
        rows_processed || 0,
        rows_processed || 0,
        now,
        now,
        sourceId
      )

      return NextResponse.json({
        success: true,
        action: 'updated',
        watermark: {
          source_id: sourceId,
          watermark_column,
          watermark_type,
          previous_value: existing.current_value,
          current_value: new_value,
          last_run_rows_processed: rows_processed,
          total_rows_processed: (existing.total_rows_processed || 0) + (rows_processed || 0),
        },
      })
    }

    // Create new watermark record
    const id = generateId()
    db.prepare(`
      INSERT INTO source_watermarks (
        id, source_id, watermark_column, watermark_type,
        current_value, previous_value,
        last_run_rows_processed, total_rows_processed,
        last_successful_run, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      sourceId,
      watermark_column,
      watermark_type,
      new_value || null,
      null, // previous_value
      rows_processed || 0,
      rows_processed || 0,
      now,
      now,
      now
    )

    return NextResponse.json({
      success: true,
      action: 'created',
      id,
      watermark: {
        source_id: sourceId,
        watermark_column,
        watermark_type,
        current_value: new_value,
        previous_value: null,
        last_run_rows_processed: rows_processed,
        total_rows_processed: rows_processed,
      },
    })
  } catch (error) {
    console.error('Error updating watermark:', error)
    return NextResponse.json(
      { error: 'Failed to update watermark', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sources/[sourceId]/watermark
 *
 * Reset/delete watermark (for re-processing all data)
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ sourceId: string }> }
) {
  try {
    const { sourceId } = await params
    const db = getDb()

    const result = db
      .prepare(`DELETE FROM source_watermarks WHERE source_id = ?`)
      .run(sourceId)

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'No watermark found for this source' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Watermark deleted. Next run will process all data.',
    })
  } catch (error) {
    console.error('Error deleting watermark:', error)
    return NextResponse.json(
      { error: 'Failed to delete watermark', details: String(error) },
      { status: 500 }
    )
  }
}
