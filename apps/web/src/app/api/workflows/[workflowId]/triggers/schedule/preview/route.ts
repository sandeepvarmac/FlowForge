import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execFileAsync = promisify(execFile)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/workflows/:workflowId/triggers/schedule/preview
 * Preview next N scheduled run times for a cron expression
 *
 * Query params:
 * - cron: cron expression (required)
 * - timezone: timezone (default: UTC)
 * - count: number of runs to preview (default: 5, max: 20)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const cronExpression = searchParams.get('cron')
    const timezone = searchParams.get('timezone') || 'UTC'
    const count = Math.min(parseInt(searchParams.get('count') || '5'), 20)

    if (!cronExpression) {
      return NextResponse.json(
        { error: 'cron parameter is required' },
        { status: 400 }
      )
    }

    // Validate cron expression format (basic validation)
    const cronParts = cronExpression.trim().split(/\s+/)
    if (cronParts.length !== 5) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Expected 5 fields: minute hour day month weekday' },
        { status: 400 }
      )
    }

    // Call Python script to calculate next runs
    const scriptPath = path.join(process.cwd(), '..', '..', 'prefect-flows', 'scripts', 'calculate_cron.py')
    const pythonExecutable = process.env.PYTHON_PATH || 'python'

    try {
      const { stdout, stderr } = await execFileAsync(
        pythonExecutable,
        [scriptPath, cronExpression, timezone, count.toString()],
        { timeout: 10000 }
      )

      if (stderr) {
        console.error('Python script stderr:', stderr)
      }

      // Parse Python script output
      const result = JSON.parse(stdout)

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Failed to calculate schedule' },
          { status: 400 }
        )
      }

      console.log(`Calculated ${result.nextRuns.length} preview runs for cron: ${cronExpression}`)

      return NextResponse.json({
        nextRuns: result.nextRuns,
        cronExpression: result.cronExpression,
        timezone: result.timezone,
        description: result.description
      })

    } catch (pythonError: any) {
      // If Python script fails, fall back to basic validation
      console.error('Python script execution failed:', pythonError)

      // Return a helpful error message
      return NextResponse.json(
        {
          error: 'Failed to calculate schedule. Ensure Python environment is configured with croniter and pytz libraries.',
          details: pythonError.message
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Error previewing schedule:', error)
    return NextResponse.json(
      { error: 'Failed to preview schedule' },
      { status: 500 }
    )
  }
}
