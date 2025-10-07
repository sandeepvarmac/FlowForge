import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params
    const db = getDatabase()

    const job = db.prepare(`
      SELECT id, workflow_id FROM jobs WHERE id = ?
    `).get(jobId) as { id: string; workflow_id: string } | undefined

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      )
    }

    db.prepare(`
      DELETE FROM jobs WHERE id = ?
    `).run(jobId)

    return NextResponse.json({
      success: true,
      jobId,
      workflowId: job.workflow_id
    })

  } catch (error: any) {
    console.error('Error deleting job:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete job' },
      { status: 500 }
    )
  }
}
