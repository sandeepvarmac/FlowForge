import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

/**
 * GET /api/reconciliation/rules/[ruleId]
 * Get a specific reconciliation rule
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const db = getDatabase()

    const rule = db.prepare(`
      SELECT
        r.*,
        w.name as workflow_name
      FROM reconciliation_rules r
      LEFT JOIN pipelines w ON r.pipeline_id = w.id
      WHERE r.id = ?
    `).get(ruleId)

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        is_active: Boolean((rule as any).is_active),
        ai_generated: Boolean((rule as any).ai_generated),
      }
    })

  } catch (error: any) {
    console.error('Failed to fetch reconciliation rule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/reconciliation/rules/[ruleId]
 * Update a reconciliation rule
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const body = await request.json()
    const db = getDatabase()

    // Check if rule exists
    const existing = db.prepare('SELECT id FROM reconciliation_rules WHERE id = ?').get(ruleId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      )
    }

    // Build update query dynamically based on provided fields
    const allowedFields = [
      'rule_name', 'rule_type', 'source_layer', 'target_layer',
      'source_table', 'target_table', 'column_name', 'tolerance_percentage',
      'reasoning', 'is_active'
    ]

    const updates: string[] = []
    const values: any[] = []

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`)
        values.push(body[field])
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push('updated_at = ?')
    values.push(Date.now())
    values.push(ruleId)

    db.prepare(`
      UPDATE reconciliation_rules
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    const updated = db.prepare(`
      SELECT * FROM reconciliation_rules WHERE id = ?
    `).get(ruleId)

    return NextResponse.json({
      success: true,
      rule: updated
    })

  } catch (error: any) {
    console.error('Failed to update reconciliation rule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/reconciliation/rules/[ruleId]
 * Delete a reconciliation rule
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const { searchParams } = new URL(request.url)
    const hardDelete = searchParams.get('hard') === 'true'

    const db = getDatabase()

    // Check if rule exists
    const existing = db.prepare('SELECT id FROM reconciliation_rules WHERE id = ?').get(ruleId)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Rule not found' },
        { status: 404 }
      )
    }

    if (hardDelete) {
      // Permanent deletion
      db.prepare('DELETE FROM reconciliation_rules WHERE id = ?').run(ruleId)
    } else {
      // Soft delete - just deactivate
      db.prepare(`
        UPDATE reconciliation_rules
        SET is_active = 0, updated_at = ?
        WHERE id = ?
      `).run(Date.now(), ruleId)
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Rule permanently deleted' : 'Rule deactivated'
    })

  } catch (error: any) {
    console.error('Failed to delete reconciliation rule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
