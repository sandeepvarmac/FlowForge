import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    // Get executions for this workflow
    const executions = db.prepare(`
      SELECT
        e.*,
        (
          SELECT COUNT(*)
          FROM job_executions je
          WHERE je.execution_id = e.id AND je.status = 'completed'
        ) as completed_jobs,
        (
          SELECT COUNT(*)
          FROM job_executions je
          WHERE je.execution_id = e.id AND je.status = 'failed'
        ) as failed_jobs,
        (
          SELECT SUM(je.records_processed)
          FROM job_executions je
          WHERE je.execution_id = e.id
        ) as total_records
      FROM executions e
      WHERE e.workflow_id = ?
      ORDER BY e.created_at DESC
      LIMIT 50
    `).all(workflowId)

    // For each execution, get job execution details
    const executionsWithJobs = executions.map((execution: any) => {
      const jobExecutions = db.prepare(`
        SELECT
          je.*,
          j.name as job_name,
          j.type as job_type
        FROM job_executions je
        JOIN jobs j ON je.job_id = j.id
        WHERE je.execution_id = ?
        ORDER BY je.created_at ASC
      `).all(execution.id)

      return {
        ...execution,
        jobExecutions: jobExecutions.map((je: any) => ({
          ...je,
          startedAt: je.started_at ? new Date(je.started_at) : undefined,
          completedAt: je.completed_at ? new Date(je.completed_at) : undefined,
          createdAt: new Date(je.created_at),
          updatedAt: new Date(je.updated_at)
        })),
        startedAt: execution.started_at ? new Date(execution.started_at) : undefined,
        completedAt: execution.completed_at ? new Date(execution.completed_at) : undefined,
        createdAt: new Date(execution.created_at),
        updatedAt: new Date(execution.updated_at)
      }
    })

    return NextResponse.json({ executions: executionsWithJobs })

  } catch (error: any) {
    console.error('Error fetching executions:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch executions' },
      { status: 500 }
    )
  }
}
