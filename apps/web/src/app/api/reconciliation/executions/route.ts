import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

/**
 * GET /api/reconciliation/executions
 * List reconciliation execution results with optional filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const executionId = searchParams.get('execution_id')
    const ruleId = searchParams.get('rule_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '100')

    const db = getDatabase()

    let query = `
      SELECT
        re.*,
        rr.rule_name,
        rr.rule_type,
        rr.source_layer,
        rr.target_layer,
        rr.source_table,
        rr.target_table,
        rr.tolerance_percentage,
        e.pipeline_id as workflow_id,
        w.name as workflow_name
      FROM reconciliation_executions re
      LEFT JOIN reconciliation_rules rr ON re.rule_id = rr.id
      LEFT JOIN executions e ON re.execution_id = e.id
      LEFT JOIN pipelines w ON e.pipeline_id = w.id
      WHERE 1=1
    `
    const params: any[] = []

    if (executionId) {
      query += ` AND re.execution_id = ?`
      params.push(executionId)
    }

    if (ruleId) {
      query += ` AND re.rule_id = ?`
      params.push(ruleId)
    }

    if (status) {
      query += ` AND re.status = ?`
      params.push(status)
    }

    query += ` ORDER BY re.execution_time DESC LIMIT ?`
    params.push(limit)

    const executions = db.prepare(query).all(...params)

    // Calculate summary statistics
    const summary = executions.reduce((acc: any, exec: any) => {
      acc.total++
      if (exec.status === 'passed') acc.passed++
      if (exec.status === 'failed') acc.failed++
      if (exec.status === 'warning') acc.warning++
      return acc
    }, { total: 0, passed: 0, failed: 0, warning: 0 })

    summary.pass_rate = summary.total > 0
      ? Math.round((summary.passed / summary.total) * 100)
      : 0

    return NextResponse.json({
      success: true,
      executions: executions.map((exec: any) => ({
        ...exec,
        pass_threshold_met: Boolean(exec.pass_threshold_met),
      })),
      summary
    })

  } catch (error: any) {
    console.error('Failed to fetch reconciliation executions:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reconciliation/executions
 * Create a new reconciliation execution result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      rule_id,
      execution_id,
      status,
      source_value,
      target_value,
      difference,
      difference_percentage,
      ai_explanation,
      pass_threshold_met = 1,
      error_message,
    } = body

    // Validate required fields
    if (!rule_id || !execution_id || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: rule_id, execution_id, status' },
        { status: 400 }
      )
    }

    // Validate status
    const validStatuses = ['passed', 'failed', 'warning']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDatabase()
    const execId = `recon_exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const now = Date.now()

    db.prepare(`
      INSERT INTO reconciliation_executions (
        id, rule_id, execution_id, execution_time,
        status, source_value, target_value, difference, difference_percentage,
        ai_explanation, pass_threshold_met, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      execId, rule_id, execution_id, now,
      status, source_value || null, target_value || null,
      difference || null, difference_percentage || null,
      ai_explanation || null, pass_threshold_met, error_message || null, now
    )

    const newExecution = db.prepare(`
      SELECT
        re.*,
        rr.rule_name,
        rr.rule_type
      FROM reconciliation_executions re
      LEFT JOIN reconciliation_rules rr ON re.rule_id = rr.id
      WHERE re.id = ?
    `).get(execId)

    return NextResponse.json({
      success: true,
      execution: newExecution
    })

  } catch (error: any) {
    console.error('Failed to create reconciliation execution:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
