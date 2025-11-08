/**
 * Quality Quarantine API
 * GET /api/quality/quarantine - Get quarantined records
 * PATCH /api/quality/quarantine/[id] - Update quarantine status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobExecutionId = searchParams.get('job_execution_id')
    const ruleExecutionId = searchParams.get('rule_execution_id')
    const status = searchParams.get('status') || 'quarantined'
    const limit = parseInt(searchParams.get('limit') || '100')

    const db = getDb()

    let query = `
      SELECT
        dqq.*,
        dqr.rule_name,
        dqr.rule_type,
        dqr.column_name,
        dqr.severity
      FROM dq_quarantine dqq
      LEFT JOIN dq_rule_executions dqe ON dqq.rule_execution_id = dqe.id
      LEFT JOIN dq_rules dqr ON dqe.rule_id = dqr.id
      WHERE 1=1
    `
    const params: any[] = []

    if (jobExecutionId) {
      query += ' AND dqq.job_execution_id = ?'
      params.push(jobExecutionId)
    }

    if (ruleExecutionId) {
      query += ' AND dqq.rule_execution_id = ?'
      params.push(ruleExecutionId)
    }

    if (status) {
      query += ' AND dqq.quarantine_status = ?'
      params.push(status)
    }

    query += ' ORDER BY dqq.created_at DESC LIMIT ?'
    params.push(limit)

    const quarantined = db.prepare(query).all(...params)

    // Parse JSON record data
    const quarantinedWithParsedData = quarantined.map((item: any) => ({
      ...item,
      record_data: item.record_data ? JSON.parse(item.record_data) : null
    }))

    // Calculate summary statistics
    const summary = db.prepare(`
      SELECT
        quarantine_status,
        COUNT(*) as count
      FROM dq_quarantine
      ${jobExecutionId ? 'WHERE job_execution_id = ?' : ''}
      GROUP BY quarantine_status
    `).all(jobExecutionId ? [jobExecutionId] : [])

    return NextResponse.json({
      success: true,
      quarantined: quarantinedWithParsedData,
      summary
    })
  } catch (error) {
    console.error('Failed to fetch quarantined records:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quarantined records' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, quarantine_status, reviewed_by } = body

    if (!id || !quarantine_status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: id, quarantine_status' },
        { status: 400 }
      )
    }

    const validStatuses = ['quarantined', 'approved', 'rejected', 'fixed']
    if (!validStatuses.includes(quarantine_status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDb()

    // Check if record exists
    const existing = db.prepare('SELECT * FROM dq_quarantine WHERE id = ?').get(id)

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Quarantine record not found' },
        { status: 404 }
      )
    }

    // Update quarantine status
    db.prepare(`
      UPDATE dq_quarantine
      SET quarantine_status = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ?
    `).run(quarantine_status, reviewed_by || null, Date.now(), id)

    const updated = db.prepare('SELECT * FROM dq_quarantine WHERE id = ?').get(id) as any

    return NextResponse.json({
      success: true,
      quarantine: {
        ...updated,
        record_data: updated.record_data ? JSON.parse(updated.record_data) : null
      }
    })
  } catch (error) {
    console.error('Failed to update quarantine record:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update quarantine record' },
      { status: 500 }
    )
  }
}
