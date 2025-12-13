/**
 * Quality Rules API
 * GET /api/quality/rules - Get all quality rules or filter by job_id
 * POST /api/quality/rules - Create new quality rule (manual or AI-generated)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    // Accept both the new "source_id" and legacy "job_id" param for backward compatibility
    const sourceId = searchParams.get('source_id') || searchParams.get('job_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    const db = getDb()

    let query = 'SELECT * FROM dq_rules WHERE 1=1'
    const params: any[] = []

    if (sourceId) {
      query += ' AND source_id = ?'
      params.push(sourceId)
    }

    if (!includeInactive) {
      query += ' AND is_active = 1'
    }

    query += ' ORDER BY created_at DESC'

    const rules = db.prepare(query).all(...params)

    // Parse JSON parameters
    const rulesWithParsedParams = rules.map((rule: any) => ({
      ...rule,
      parameters: rule.parameters ? JSON.parse(rule.parameters) : null,
      ai_generated: rule.ai_generated === 1
    }))

    return NextResponse.json({
      success: true,
      rules: rulesWithParsedParams
    })
  } catch (error) {
    console.error('Failed to fetch quality rules:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch quality rules' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    let body: any = {}
    try {
      body = rawBody ? JSON.parse(rawBody) : {}
    } catch (parseError: any) {
      console.error('Failed to parse quality rule request body:', rawBody, parseError?.message)
      return NextResponse.json(
        { success: false, error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }
    const {
      // Legacy: job_id, Current: source_id
      job_id,
      source_id,
      rule_id,
      rule_name,
      column_name,
      rule_type,
      parameters,
      confidence,
      current_compliance,
      reasoning,
      ai_generated,
      severity
    } = body

    const resolvedSourceId = source_id || job_id

    // Validation
    if (!resolvedSourceId || !rule_id || !rule_name || !column_name || !rule_type || !severity) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Missing required fields: source_id (or job_id), rule_id, rule_name, column_name, rule_type, severity'
        },
        { status: 400 }
      )
    }

    const validRuleTypes = ['not_null', 'unique', 'range', 'pattern', 'enum', 'custom']
    if (!validRuleTypes.includes(rule_type)) {
      return NextResponse.json(
        { success: false, error: `Invalid rule_type. Must be one of: ${validRuleTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const validSeverities = ['error', 'warning', 'info']
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      )
    }

    const db = getDb()
    const now = Date.now()
    const id = uuidv4()

    // Insert quality rule
    db.prepare(`
      INSERT INTO dq_rules (
        id, source_id, rule_id, rule_name, column_name, rule_type, parameters,
        confidence, current_compliance, reasoning, ai_generated,
        severity, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      resolvedSourceId,
      rule_id,
      rule_name,
      column_name,
      rule_type,
      (() => {
        if (!parameters) return null
        // Accept both object and stringified JSON
        if (typeof parameters === 'string') return parameters
        try {
          return JSON.stringify(parameters)
        } catch {
          return null
        }
      })(),
      confidence || 0,
      current_compliance || null,
      reasoning || null,
      ai_generated ? 1 : 0,
      severity,
      1, // is_active
      now,
      now
    )

    const createdRule = db.prepare('SELECT * FROM dq_rules WHERE id = ?').get(id) as any

    return NextResponse.json({
      success: true,
      rule: {
        ...createdRule,
        parameters: createdRule.parameters ? JSON.parse(createdRule.parameters) : null,
        ai_generated: createdRule.ai_generated === 1
      }
    })
  } catch (error: any) {
    console.error('Failed to create quality rule:', error?.message || error, error?.stack)

    if (error.message?.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: 'A rule with this rule_id already exists for this job' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create quality rule' },
      { status: 500 }
    )
  }
}
