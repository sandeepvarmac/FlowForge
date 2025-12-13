/**
 * File Duplicate Check API
 *
 * Checks if a file with the same hash has already been processed.
 * Used to prevent re-processing the same file twice.
 */

import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

interface FileProcessingLog {
  id: string
  source_id: string
  file_name: string
  landing_key: string
  file_hash: string
  status: string
  processed_at: string
}

/**
 * POST /api/files/check-duplicate
 *
 * Check if a file has already been processed
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()

    const { source_id, file_hash } = body

    if (!source_id || !file_hash) {
      return NextResponse.json(
        { error: 'Missing required fields: source_id, file_hash' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Check if a file with this hash has been successfully processed
    const existing = db.prepare(`
      SELECT id, file_name, landing_key, status, processing_completed_at
      FROM file_processing_log
      WHERE source_id = ?
        AND file_hash = ?
        AND status IN ('completed', 'archived')
      ORDER BY processing_completed_at DESC
      LIMIT 1
    `).get(source_id, file_hash) as FileProcessingLog | undefined

    if (existing) {
      return NextResponse.json({
        is_duplicate: true,
        existing_file: {
          id: existing.id,
          file_name: existing.file_name,
          landing_key: existing.landing_key,
          status: existing.status,
          processed_at: existing.processed_at,
        },
        message: 'File with this hash has already been processed',
      })
    }

    return NextResponse.json({
      is_duplicate: false,
      message: 'File has not been processed before',
    })
  } catch (error) {
    console.error('Error checking duplicate:', error)
    return NextResponse.json(
      { error: 'Failed to check duplicate', details: String(error) },
      { status: 500 }
    )
  }
}
