import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const { executionId } = params
    const db = getDatabase()

    // Get execution details
    const executionQuery = `
      SELECT
        e.*,
        w.name as workflow_name,
        w.description as workflow_description,
        w.business_unit,
        w.tags as workflow_tags
      FROM executions e
      JOIN workflows w ON e.workflow_id = w.id
      WHERE e.id = ?
    `
    const execution = db.prepare(executionQuery).get(executionId)

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      )
    }

    // Get job executions with job details
    const jobExecutionsQuery = `
      SELECT
        je.*,
        j.name as job_name,
        j.type as job_type,
        j.order_index,
        j.description as job_description
      FROM job_executions je
      JOIN jobs j ON je.job_id = j.id
      WHERE je.execution_id = ?
      ORDER BY j.order_index ASC
    `
    const jobExecutions = db.prepare(jobExecutionsQuery).all(executionId)

    // Parse JSON fields
    const parsedJobExecutions = jobExecutions.map((je: any) => ({
      ...je,
      validation_results: je.validation_results ? JSON.parse(je.validation_results) : null,
      logs: je.logs ? JSON.parse(je.logs) : []
    }))

    // Calculate aggregate metrics
    const metrics = {
      totalJobs: jobExecutions.length,
      completedJobs: jobExecutions.filter((je: any) => je.status === 'completed').length,
      failedJobs: jobExecutions.filter((je: any) => je.status === 'failed').length,
      runningJobs: jobExecutions.filter((je: any) => je.status === 'running').length,
      totalRecordsProcessed: jobExecutions.reduce((sum: number, je: any) => sum + (je.records_processed || 0), 0),
      totalBronzeRecords: jobExecutions.reduce((sum: number, je: any) => sum + (je.bronze_records || 0), 0),
      totalSilverRecords: jobExecutions.reduce((sum: number, je: any) => sum + (je.silver_records || 0), 0),
      totalGoldRecords: jobExecutions.reduce((sum: number, je: any) => sum + (je.gold_records || 0), 0)
    }

    return NextResponse.json({
      execution,
      jobExecutions: parsedJobExecutions,
      metrics,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('❌ Error fetching execution details:', error)
    return NextResponse.json(
      { error: 'Failed to fetch execution details' },
      { status: 500 }
    )
  }
}
