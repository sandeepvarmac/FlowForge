import { NextRequest, NextResponse } from 'next/server'
import { executeJob } from '@/lib/processing/job-executor'
import { getDatabase } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params
    const db = getDatabase()

    // Get workflow with jobs
    const workflow = db.prepare(`
      SELECT * FROM workflows WHERE id = ?
    `).get(workflowId) as any

    if (!workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    const jobs = db.prepare(`
      SELECT * FROM jobs WHERE workflow_id = ? ORDER BY order_index ASC
    `).all(workflowId) as any[]

    if (!jobs || jobs.length === 0) {
      return NextResponse.json(
        { error: 'No jobs found in workflow' },
        { status: 400 }
      )
    }

    console.log(`🚀 Starting workflow execution: ${workflow.name} (${workflowId})`)
    console.log(`📋 Jobs to execute: ${jobs.length}`)

    // Create execution record
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const startTime = new Date().toISOString()

    db.prepare(`
      INSERT INTO executions (id, workflow_id, status, started_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(executionId, workflowId, 'running', startTime, startTime, startTime)

    // Execute jobs sequentially
    let overallStatus = 'completed'
    const jobResults = []

    for (const job of jobs) {
      // Parse job configuration from database columns
      const sourceConfig = typeof job.source_config === 'string' ? JSON.parse(job.source_config) : job.source_config
      const destinationConfig = typeof job.destination_config === 'string' ? JSON.parse(job.destination_config) : job.destination_config
      const transformationConfig = job.transformation_config ? (typeof job.transformation_config === 'string' ? JSON.parse(job.transformation_config) : job.transformation_config) : undefined
      const validationConfig = job.validation_config ? (typeof job.validation_config === 'string' ? JSON.parse(job.validation_config) : job.validation_config) : undefined

      const jobData = {
        id: job.id,
        workflowId: job.workflow_id,
        name: job.name,
        description: job.description ?? undefined,
        type: job.type,
        order: job.order_index ?? 0,
        status: job.status,
        sourceConfig: sourceConfig,
        destinationConfig: destinationConfig,
        transformationConfig,
        validationConfig,
        lastRun: job.last_run ? new Date(job.last_run) : undefined,
        createdAt: new Date(job.created_at),
        updatedAt: new Date(job.updated_at)
      }

      console.log(`\n▶️  Executing job: ${job.name} (${job.id})`)
      console.log(`   Type: ${job.type}`)
      console.log(`   Source:`, sourceConfig)
      console.log(`   Destination:`, destinationConfig)

      const jobStartTime = new Date().toISOString()

      // Create job execution record
      const jobExecutionId = `job_exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

      db.prepare(`
        INSERT INTO job_executions (id, execution_id, job_id, status, started_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(jobExecutionId, executionId, job.id, 'running', jobStartTime, jobStartTime, jobStartTime)

      try {
        // Get source file path from job configuration
        const fileName = sourceConfig.fileConfig?.filePath || sourceConfig.filePath || ''

        // Resolve the full path - API runs from apps/web, so go up to project root
        const sourceFilePath = `../../sample-data/${fileName}`

        console.log(`   Source file path: ${sourceFilePath}`)

        // Execute the job
        const result = await executeJob(jobData, sourceFilePath)

        const jobEndTime = new Date().toISOString()
        const duration = new Date(jobEndTime).getTime() - new Date(jobStartTime).getTime()

        // Update job execution record
        db.prepare(`
          UPDATE job_executions
          SET status = ?, completed_at = ?, duration_ms = ?,
              records_processed = ?, bronze_records = ?, silver_records = ?, gold_records = ?,
              bronze_file_path = ?, silver_file_path = ?, gold_file_path = ?,
              updated_at = ?
          WHERE id = ?
        `).run(
          'completed',
          jobEndTime,
          duration,
          result.bronzeRecords + result.silverRecords + result.goldRecords,
          result.bronzeRecords,
          result.silverRecords,
          result.goldRecords,
          result.bronzeFilePath,
          result.silverFilePath,
          result.goldFilePath,
          jobEndTime,
          jobExecutionId
        )

        console.log(`✅ Job completed: ${job.name}`)
        console.log(`   Bronze records: ${result.bronzeRecords}`)
        console.log(`   Silver records: ${result.silverRecords}`)
        console.log(`   Gold records: ${result.goldRecords}`)
        console.log(`   Duration: ${duration}ms`)

        jobResults.push({
          jobId: job.id,
          jobName: job.name,
          status: 'completed',
          recordsProcessed: result.bronzeRecords + result.silverRecords + result.goldRecords,
          duration
        })

        // Update job's last run
        db.prepare(`
          UPDATE jobs SET last_run = ?, updated_at = ? WHERE id = ?
        `).run(jobEndTime, jobEndTime, job.id)

      } catch (error: any) {
        const jobEndTime = new Date().toISOString()
        const duration = new Date(jobEndTime).getTime() - new Date(jobStartTime).getTime()

        overallStatus = 'failed'

        // Update job execution record with error
        db.prepare(`
          UPDATE job_executions
          SET status = ?, completed_at = ?, duration_ms = ?,
              error_message = ?, updated_at = ?
          WHERE id = ?
        `).run('failed', jobEndTime, duration, error.message, jobEndTime, jobExecutionId)

        console.error(`❌ Job failed: ${job.name}`)
        console.error(`   Error: ${error.message}`)

        jobResults.push({
          jobId: job.id,
          jobName: job.name,
          status: 'failed',
          error: error.message,
          duration
        })

        // Stop execution on first failure
        break
      }
    }

    // Update execution record
    const endTime = new Date().toISOString()
    const totalDuration = new Date(endTime).getTime() - new Date(startTime).getTime()

    db.prepare(`
      UPDATE executions
      SET status = ?, completed_at = ?, duration_ms = ?, updated_at = ?
      WHERE id = ?
    `).run(overallStatus, endTime, totalDuration, endTime, executionId)

    // Update workflow's last run
    db.prepare(`
      UPDATE workflows SET last_run = ?, updated_at = ? WHERE id = ?
    `).run(endTime, endTime, workflowId)

    console.log(`\n${overallStatus === 'completed' ? '✅' : '❌'} Workflow execution ${overallStatus}: ${workflow.name}`)
    console.log(`   Total duration: ${totalDuration}ms`)

    return NextResponse.json({
      success: overallStatus === 'completed',
      executionId,
      status: overallStatus,
      duration: totalDuration,
      jobResults
    })

  } catch (error: any) {
    console.error('❌ Workflow execution error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute workflow' },
      { status: 500 }
    )
  }
}


