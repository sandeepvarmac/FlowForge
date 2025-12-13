import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { existsSync } from 'fs'
import { getDatabase } from '@/lib/db'

/**
 * GET /api/data-assets/[id]/sample
 * Fetch sample data from a Parquet file in MinIO
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '100', 10)

    // Get asset details to retrieve file_path
    const db = getDatabase()
    const asset = db
      .prepare('SELECT * FROM metadata_catalog WHERE id = ?')
      .get(id) as any

    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    if (!asset.file_path) {
      return NextResponse.json(
        { error: 'No file path available for this asset' },
        { status: 400 }
      )
    }

    // Execute Python script to read Parquet sample (no mock fallback to avoid mismatched data)
    const prefectFlowsDir = path.join(process.cwd(), '..', '..', 'prefect-flows')
    const repoVenv = path.join(process.cwd(), '.venv', 'Scripts', 'python.exe')
    const flowsVenv = path.join(prefectFlowsDir, '.venv', 'Scripts', 'python.exe')
    const pythonExecutable = existsSync(flowsVenv) ? flowsVenv : existsSync(repoVenv) ? repoVenv : 'python'

    const result = await executePythonModule(
      pythonExecutable,
      prefectFlowsDir,
      'utils.parquet_sample',
      [asset.file_path, limit.toString()]
    )
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error fetching sample data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sample data' },
      { status: 500 }
    )
  }
}

/**
 * Execute Python module and return parsed JSON result
 * Uses: python -m module.name args
 */
function executePythonModule(
  pythonPath: string,
  workingDir: string,
  moduleName: string,
  args: string[]
): Promise<any> {
  return new Promise((resolve, reject) => {
    const proc = spawn(pythonPath, ['-m', moduleName, ...args], {
      cwd: workingDir,
      env: { ...process.env }
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python module failed: ${stderr || stdout}`))
        return
      }

      try {
        const result = JSON.parse(stdout)
        if (result.error) {
          reject(new Error(result.error))
        } else {
          resolve(result)
        }
      } catch (error) {
        reject(new Error(`Failed to parse Python output: ${stdout}`))
      }
    })

    proc.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`))
    })
  })
}
