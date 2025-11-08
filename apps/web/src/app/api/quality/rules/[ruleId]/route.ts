/**
 * Individual Quality Rule API
 * GET /api/quality/rules/[ruleId] - Get specific rule
 * PATCH /api/quality/rules/[ruleId] - Update rule
 * DELETE /api/quality/rules/[ruleId] - Delete/deactivate rule
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const db = getDb()

    const rule = db.prepare('SELECT * FROM dq_rules WHERE id = ?').get(ruleId) as any

    if (!rule) {
      return NextResponse.json(
        { success: false, error: 'Quality rule not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      rule: {
        ...rule,
        parameters: rule.parameters ? JSON.parse(rule.parameters) : null,
        ai_generated: rule.ai_generated === 1
      }
    })
  } catch (error) {
    console.error('Failed to fetch quality rule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quality rule' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const body = await request.json()
    const db = getDb()

    // Check if rule exists
    const existingRule = db.prepare('SELECT * FROM dq_rules WHERE id = ?').get(ruleId)

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Quality rule not found' },
        { status: 404 }
      )
    }

    const {
      rule_name,
      column_name,
      rule_type,
      parameters,
      confidence,
      current_compliance,
      reasoning,
      severity,
      is_active
    } = body

    const updates: string[] = []
    const values: any[] = []

    if (rule_name !== undefined) {
      updates.push('rule_name = ?')
      values.push(rule_name)
    }
    if (column_name !== undefined) {
      updates.push('column_name = ?')
      values.push(column_name)
    }
    if (rule_type !== undefined) {
      updates.push('rule_type = ?')
      values.push(rule_type)
    }
    if (parameters !== undefined) {
      updates.push('parameters = ?')
      values.push(parameters ? JSON.stringify(parameters) : null)
    }
    if (confidence !== undefined) {
      updates.push('confidence = ?')
      values.push(confidence)
    }
    if (current_compliance !== undefined) {
      updates.push('current_compliance = ?')
      values.push(current_compliance)
    }
    if (reasoning !== undefined) {
      updates.push('reasoning = ?')
      values.push(reasoning)
    }
    if (severity !== undefined) {
      updates.push('severity = ?')
      values.push(severity)
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?')
      values.push(is_active ? 1 : 0)
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
      UPDATE dq_rules
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values)

    const updatedRule = db.prepare('SELECT * FROM dq_rules WHERE id = ?').get(ruleId) as any

    return NextResponse.json({
      success: true,
      rule: {
        ...updatedRule,
        parameters: updatedRule.parameters ? JSON.parse(updatedRule.parameters) : null,
        ai_generated: updatedRule.ai_generated === 1
      }
    })
  } catch (error) {
    console.error('Failed to update quality rule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update quality rule' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { ruleId: string } }
) {
  try {
    const { ruleId } = params
    const searchParams = request.nextUrl.searchParams
    const hardDelete = searchParams.get('hard_delete') === 'true'

    const db = getDb()

    // Check if rule exists
    const existingRule = db.prepare('SELECT * FROM dq_rules WHERE id = ?').get(ruleId)

    if (!existingRule) {
      return NextResponse.json(
        { success: false, error: 'Quality rule not found' },
        { status: 404 }
      )
    }

    if (hardDelete) {
      // Permanently delete
      db.prepare('DELETE FROM dq_rules WHERE id = ?').run(ruleId)
    } else {
      // Soft delete (deactivate)
      db.prepare('UPDATE dq_rules SET is_active = 0, updated_at = ? WHERE id = ?')
        .run(Date.now(), ruleId)
    }

    return NextResponse.json({
      success: true,
      message: hardDelete ? 'Quality rule deleted permanently' : 'Quality rule deactivated'
    })
  } catch (error) {
    console.error('Failed to delete quality rule:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete quality rule' },
      { status: 500 }
    )
  }
}
