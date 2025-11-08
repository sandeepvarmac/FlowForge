/**
 * Quality Rule Executions API
 * GET /api/quality/executions - Get execution history
 * Supports filtering by job_execution_id, rule_id, status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const jobExecutionId = searchParams.get('job_execution_id')
    const ruleId = searchParams.get('rule_id')
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    const db = getDb()

    let query = `
      SELECT
        dqe.*,
        dqr.rule_name,
        dqr.rule_type,
        dqr.column_name,
        dqr.severity,
        dqr.reasoning
      FROM dq_rule_executions dqe
      LEFT JOIN dq_rules dqr ON dqe.rule_id = dqr.id
      WHERE 1=1
    `
    const params: any[] = []

    if (jobExecutionId) {
      query += ' AND dqe.job_execution_id = ?'
      params.push(jobExecutionId)
    }

    if (ruleId) {
      query += ' AND dqe.rule_id = ?'
      params.push(ruleId)
    }

    if (status) {
      query += ' AND dqe.status = ?'
      params.push(status)
    }

    query += ' ORDER BY dqe.execution_time DESC LIMIT ?'
    params.push(limit)

    const executions = db.prepare(query).all(...params)

    // Parse JSON fields
    const executionsWithParsedData = executions.map((exec: any) => ({
      ...exec,
      failed_records_sample: exec.failed_records_sample
        ? JSON.parse(exec.failed_records_sample)
        : null
    }))

    // Calculate summary statistics if filtering by job_execution_id
    let summary = null
    if (jobExecutionId) {
      const summaryData = db.prepare(`
        SELECT
          COUNT(*) as total_rules,
          SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed_count,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          SUM(CASE WHEN status = 'warning' THEN 1 ELSE 0 END) as warning_count,
          SUM(records_checked) as total_records_checked,
          SUM(records_failed) as total_records_failed,
          AVG(pass_percentage) as avg_pass_percentage
        FROM dq_rule_executions
        WHERE job_execution_id = ?
      `).get(jobExecutionId) as any

      summary = {
        ...summaryData,
        overall_quality_score: Math.round(summaryData.avg_pass_percentage || 0)
      }
    }

    return NextResponse.json({
      success: true,
      executions: executionsWithParsedData,
      summary
    })
  } catch (error) {
    console.error('Failed to fetch quality executions:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quality executions' },
      { status: 500 }
    )
  }
}
