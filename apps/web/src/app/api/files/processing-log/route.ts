/**
 * File Processing Log API
 *
 * Tracks file processing status for file-based sources.
 * Used by Prefect workers to log file processing and by UI to display status.
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

function generateId(): string {
  return `fpl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * POST /api/files/processing-log
 *
 * Log a file processing event
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const {
      source_id,
      execution_id,
      file_name,
      landing_key,
      file_hash,
      file_size,
      status,
      records_processed,
      bronze_key,
      archive_key,
      error_message,
      archived_at,
    } = body

    if (!source_id || !landing_key || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: source_id, landing_key, status' },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = new Date().toISOString()
    const id = generateId()

    // Check if a record already exists for this landing_key
    const existing = db
      .prepare(`SELECT id FROM file_processing_log WHERE landing_key = ?`)
      .get(landing_key) as { id: string } | undefined

    if (existing) {
      // Update existing record
      db.prepare(`
        UPDATE file_processing_log
        SET status = ?,
            execution_id = COALESCE(?, execution_id),
            records_processed = COALESCE(?, records_processed),
            bronze_key = COALESCE(?, bronze_key),
            archive_key = COALESCE(?, archive_key),
            error_message = ?,
            archived_at = COALESCE(?, archived_at),
            processing_completed_at = CASE WHEN ? IN ('completed', 'archived', 'failed') THEN ? ELSE processing_completed_at END,
            updated_at = ?
        WHERE id = ?
      `).run(
        status,
        execution_id || null,
        records_processed || null,
        bronze_key || null,
        archive_key || null,
        error_message || null,
        archived_at || null,
        status, now,
        now,
        existing.id
      )

      return NextResponse.json({
        success: true,
        id: existing.id,
        action: 'updated',
      })
    }

    // Insert new record
    db.prepare(`
      INSERT INTO file_processing_log (
        id, source_id, execution_id, file_name, landing_key, file_hash, file_size,
        status, archive_key, archived_at, records_processed, bronze_key, error_message,
        discovered_at, processing_started_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      source_id,
      execution_id || null,
      file_name || landing_key.split('/').pop(),
      landing_key,
      file_hash || null,
      file_size || null,
      status,
      archive_key || null,
      archived_at || null,
      records_processed || 0,
      bronze_key || null,
      error_message || null,
      now, // discovered_at
      status === 'processing' ? now : null, // processing_started_at
      now,
      now
    )

    return NextResponse.json({
      success: true,
      id,
      action: 'created',
    })
  } catch (error) {
    console.error('Error logging file processing:', error)
    return NextResponse.json(
      { error: 'Failed to log file processing', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * GET /api/files/processing-log?source_id=xxx
 *
 * Get file processing history for a source
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceId = searchParams.get('source_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const db = getDb()

    let query = `
      SELECT *
      FROM file_processing_log
      WHERE 1=1
    `
    const params: (string | number)[] = []

    if (sourceId) {
      query += ` AND source_id = ?`
      params.push(sourceId)
    }

    if (status) {
      query += ` AND status = ?`
      params.push(status)
    }

    query += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)

    const files = db.prepare(query).all(...params)

    // Get summary stats
    const stats = db.prepare(`
      SELECT
        status,
        COUNT(*) as count
      FROM file_processing_log
      ${sourceId ? 'WHERE source_id = ?' : ''}
      GROUP BY status
    `).all(sourceId ? [sourceId] : [])

    return NextResponse.json({
      files,
      stats,
      total: files.length,
    })
  } catch (error) {
    console.error('Error getting file processing log:', error)
    return NextResponse.json(
      { error: 'Failed to get file processing log', details: String(error) },
      { status: 500 }
    )
  }
}
