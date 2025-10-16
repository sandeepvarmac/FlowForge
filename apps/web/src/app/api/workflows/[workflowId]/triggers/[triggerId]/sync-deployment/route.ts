import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/workflows/:workflowId/triggers/:triggerId/sync-deployment
 * Sync a scheduled trigger with Prefect deployment
 *
 * This creates or updates the Prefect deployment for a scheduled trigger.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { workflowId, triggerId } = params
    const db = getDatabase()

    // Get trigger details
    const trigger = db.prepare(`
      SELECT
        wt.*,
        w.name as workflow_name
      FROM workflow_triggers wt
      JOIN workflows w ON w.id = wt.workflow_id
      WHERE wt.id = ? AND wt.workflow_id = ?
    `).get(triggerId, workflowId) as any

    if (!trigger) {
      return NextResponse.json(
        { error: 'Trigger not found' },
        { status: 404 }
      )
    }

    // Only scheduled triggers need Prefect deployments
    if (trigger.trigger_type !== 'scheduled') {
      return NextResponse.json(
        { error: 'Only scheduled triggers can be synced with Prefect deployments' },
        { status: 400 }
      )
    }

    if (!trigger.cron_expression) {
      return NextResponse.json(
        { error: 'Scheduled trigger missing cron expression' },
        { status: 400 }
      )
    }

    // Call Python script to create/update deployment
    const scriptPath = path.join(process.cwd(), '..', '..', 'prefect-flows', 'scripts', 'sync_deployment.py')
    const pythonExecutable = process.env.PYTHON_PATH || 'python'

    const args = [
      scriptPath,
      'sync',
      triggerId,
      workflowId,
      trigger.workflow_name,
      trigger.cron_expression,
      trigger.timezone || 'UTC',
      trigger.trigger_name || '',
      trigger.enabled ? '1' : '0'
    ]

    try {
      const { stdout, stderr } = await execFileAsync(
        pythonExecutable,
        args,
        { timeout: 30000 }
      )

      if (stderr) {
        console.error('Python script stderr:', stderr)
      }

      const result = JSON.parse(stdout)

      if (!result.success) {
        console.error('Deployment sync failed:', result.error)
        return NextResponse.json(
          { error: result.error || 'Failed to sync deployment' },
          { status: 500 }
        )
      }

      // Update trigger with next_run_at if provided
      if (result.next_run_timestamp) {
        db.prepare(`
          UPDATE workflow_triggers
          SET next_run_at = ?, updated_at = ?
          WHERE id = ?
        `).run(result.next_run_timestamp, Math.floor(Date.now() / 1000), triggerId)
      }

      console.log(`Deployment synced for trigger ${triggerId}:`, result.message)

      return NextResponse.json({
        success: true,
        deployment: result,
        message: 'Deployment synced successfully'
      })

    } catch (pythonError: any) {
      console.error('Python script execution failed:', pythonError)
      return NextResponse.json(
        {
          error: 'Failed to sync deployment with Prefect. Ensure Python environment and Prefect are configured.',
          details: pythonError.message
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error syncing deployment:', error)
    return NextResponse.json(
      { error: 'Failed to sync deployment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workflows/:workflowId/triggers/:triggerId/sync-deployment
 * Remove Prefect deployment for a trigger
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { workflowId: string; triggerId: string } }
) {
  try {
    const { triggerId } = params

    // Call Python script to delete deployment
    const scriptPath = path.join(process.cwd(), '..', '..', 'prefect-flows', 'scripts', 'sync_deployment.py')
    const pythonExecutable = process.env.PYTHON_PATH || 'python'

    try {
      const { stdout, stderr } = await execFileAsync(
        pythonExecutable,
        [scriptPath, 'delete', triggerId],
        { timeout: 30000 }
      )

      if (stderr) {
        console.error('Python script stderr:', stderr)
      }

      const result = JSON.parse(stdout)

      if (!result.success) {
        console.error('Deployment deletion failed:', result.error)
        return NextResponse.json(
          { error: result.error || 'Failed to delete deployment' },
          { status: 500 }
        )
      }

      console.log(`Deployment deleted for trigger ${triggerId}:`, result.message)

      return NextResponse.json({
        success: true,
        message: 'Deployment deleted successfully'
      })

    } catch (pythonError: any) {
      console.error('Python script execution failed:', pythonError)
      return NextResponse.json(
        {
          error: 'Failed to delete deployment from Prefect.',
          details: pythonError.message
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error deleting deployment:', error)
    return NextResponse.json(
      { error: 'Failed to delete deployment' },
      { status: 500 }
    )
  }
}
