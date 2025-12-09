import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

/**
 * GET /api/reconciliation/rules
 * List reconciliation rules with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workflowId = searchParams.get('workflow_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const db = getDatabase()

    let query = `
      SELECT
        r.*,
        w.name as workflow_name
      FROM reconciliation_rules r
      LEFT JOIN pipelines w ON r.pipeline_id = w.id
      WHERE 1=1
    `
    const params: any[] = []

    if (workflowId) {
      query += ` AND r.pipeline_id = ?`
      params.push(workflowId)
    }

    if (!includeInactive) {
      query += ` AND r.is_active = 1`
    }

    query += ` ORDER BY r.created_at DESC`

    const rules = db.prepare(query).all(...params)

    return NextResponse.json({
      success: true,
      rules: rules.map((rule: any) => ({
        ...rule,
        is_active: Boolean(rule.is_active),
        ai_generated: Boolean(rule.ai_generated),
      }))
    })

  } catch (error: any) {
    console.error('Failed to fetch reconciliation rules:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reconciliation/rules
 * Create a new reconciliation rule
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      workflow_id,
      rule_name,
      rule_type,
      source_layer,
      target_layer,
      source_table,
      target_table,
      column_name,
      tolerance_percentage = 0.0,
      ai_generated = 0,
      confidence = 0,
      reasoning = '',
      is_active = 1,
    } = body

    // Validate required fields
    if (!workflow_id || !rule_name || !rule_type || !source_layer || !target_layer || !source_table) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate rule_type
    const validRuleTypes = ['count', 'sum', 'hash', 'column', 'custom']
    if (!validRuleTypes.includes(rule_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate layers
    const validLayers = ['bronze', 'silver', 'gold']
    if (!validLayers.includes(source_layer) || !validLayers.includes(target_layer)) {
      return NextResponse.json(
        { success: false, error: 'Invalid layer. Must be bronze, silver, or gold' },
        { status: 400 }
      )
    }

    const db = getDatabase()
    const ruleId = `recon_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const now = Date.now()

    db.prepare(`
      INSERT INTO reconciliation_rules (
        id, workflow_id, rule_name, rule_type,
        source_layer, target_layer, source_table, target_table,
        column_name, tolerance_percentage,
        ai_generated, confidence, reasoning,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      ruleId, workflow_id, rule_name, rule_type,
      source_layer, target_layer, source_table, target_table || null,
      column_name || null, tolerance_percentage,
      ai_generated, confidence, reasoning,
      is_active, now, now
    )

    const newRule = db.prepare(`
      SELECT * FROM reconciliation_rules WHERE id = ?
    `).get(ruleId)

    return NextResponse.json({
      success: true,
      rule: newRule
    })

  } catch (error: any) {
    console.error('Failed to create reconciliation rule:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
