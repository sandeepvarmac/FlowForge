import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ executionId: string }> }
) {
  try {
    const { executionId } = await params
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
      JOIN pipelines w ON e.pipeline_id = w.id
      WHERE e.id = ?
    `
    const execution = db.prepare(executionQuery).get(executionId)

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      )
    }

    // Get source executions with source details
    const jobExecutionsQuery = `
      SELECT
        se.*,
        s.name as job_name,
        s.type as job_type,
        s.order_index,
        s.description as job_description
      FROM source_executions se
      JOIN sources s ON se.source_id = s.id
      WHERE se.execution_id = ?
      ORDER BY s.order_index ASC
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
