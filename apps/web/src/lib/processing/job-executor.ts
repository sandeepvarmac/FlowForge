import Papa from 'papaparse'
import { getDatabase } from '../db'
import { saveParquetFile, readFile } from '../storage'
import { writeParquet, readParquet, type ColumnSchema } from './parquet-writer'
import type { Job } from '@/types/workflow'

export interface ExecutionResult {
  success: boolean
  executionId: string
  bronzeRecords: number
  silverRecords: number
  goldRecords: number
  bronzeFilePath?: string
  silverFilePath?: string
  goldFilePath?: string
  logs: string[]
  error?: string
}

/**
 * Execute a job end-to-end: CSV → Bronze → Silver → Gold
 */
export async function executeJob(
  job: Job,
  sourceFilePath: string
): Promise<ExecutionResult> {
  const db = getDatabase()
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`
  const logs: string[] = []

  const startTime = Date.now()

  const addLog = (message: string) => {
    console.log(message)
    logs.push(`[${new Date().toISOString()}] ${message}`)
  }

  try {
    addLog(`🚀 Starting job execution: ${job.name}`)

    // Create execution record
    db.prepare(`
      INSERT INTO job_executions (
        id, job_id, workflow_id, status, start_time, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      executionId,
      job.id,
      job.workflowId,
      'running',
      startTime,
      startTime
    )

    // Step 1: Bronze Layer - Read CSV and save as Parquet
    addLog('📥 Step 1: Processing Bronze Layer (Raw Data)')
    const bronzeResult = await processBronzeLayer(job, sourceFilePath, addLog)

    // Step 2: Silver Layer - Apply transformations and validations
    addLog('🔄 Step 2: Processing Silver Layer (Cleaned Data)')
    const silverResult = await processSilverLayer(
      job,
      bronzeResult.data,
      bronzeResult.schema,
      addLog
    )

    // Step 3: Gold Layer - Business aggregations and rules
    addLog('✨ Step 3: Processing Gold Layer (Business Data)')
    const goldResult = await processGoldLayer(
      job,
      silverResult.data,
      silverResult.schema,
      addLog
    )

    // Update execution record
    const endTime = Date.now()
    const duration = endTime - startTime

    db.prepare(`
      UPDATE job_executions
      SET status = ?, end_time = ?, duration = ?,
          bronze_records = ?, silver_records = ?, gold_records = ?,
          bronze_file_path = ?, silver_file_path = ?, gold_file_path = ?,
          logs = ?
      WHERE id = ?
    `).run(
      'completed',
      endTime,
      duration,
      bronzeResult.recordCount,
      silverResult.recordCount,
      goldResult.recordCount,
      bronzeResult.filePath,
      silverResult.filePath,
      goldResult.filePath,
      JSON.stringify(logs),
      executionId
    )

    // Update job status
    db.prepare(`
      UPDATE jobs
      SET status = ?, last_run = ?, updated_at = ?
      WHERE id = ?
    `).run('completed', endTime, endTime, job.id)

    addLog(`✅ Job execution completed successfully in ${duration}ms`)

    return {
      success: true,
      executionId,
      bronzeRecords: bronzeResult.recordCount,
      silverRecords: silverResult.recordCount,
      goldRecords: goldResult.recordCount,
      bronzeFilePath: bronzeResult.filePath,
      silverFilePath: silverResult.filePath,
      goldFilePath: goldResult.filePath,
      logs
    }

  } catch (error) {
    const endTime = Date.now()
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    addLog(`❌ Job execution failed: ${errorMessage}`)

    // Update execution record with error
    db.prepare(`
      UPDATE job_executions
      SET status = ?, end_time = ?, duration = ?, error = ?, logs = ?
      WHERE id = ?
    `).run(
      'failed',
      endTime,
      endTime - startTime,
      errorMessage,
      JSON.stringify(logs),
      executionId
    )

    // Update job status
    db.prepare(`
      UPDATE jobs
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run('failed', endTime, job.id)

    return {
      success: false,
      executionId,
      bronzeRecords: 0,
      silverRecords: 0,
      goldRecords: 0,
      logs,
      error: errorMessage
    }
  }
}

/**
 * Bronze Layer: Read CSV and convert to Parquet (raw data)
 */
async function processBronzeLayer(
  job: Job,
  sourceFilePath: string,
  addLog: (message: string) => void
) {
  addLog('  → Reading CSV file...')

  const fileContent = readFile(sourceFilePath).toString('utf-8')

  // Parse CSV
  const parseResult = Papa.parse(fileContent, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false // Keep as strings for Bronze
  })

  const data = parseResult.data as any[]
  const headers = parseResult.meta.fields || []

  addLog(`  → Parsed ${data.length} rows, ${headers.length} columns`)

  // Create schema (all strings in Bronze)
  const schema: ColumnSchema[] = headers.map(name => ({
    name,
    type: 'string'
  }))

  // Write to Parquet
  const tableName = job.destinationConfig.bronzeConfig.tableName || 'bronze_data'
  const outputPath = `data/bronze/${job.workflowId}/${job.id}/${tableName}.parquet`

  writeParquet(data, schema, outputPath)

  addLog(`  ✓ Bronze layer saved: ${data.length} records`)

  return {
    data,
    schema,
    recordCount: data.length,
    filePath: outputPath
  }
}

/**
 * Silver Layer: Apply transformations and data quality rules
 */
async function processSilverLayer(
  job: Job,
  bronzeData: any[],
  bronzeSchema: ColumnSchema[],
  addLog: (message: string) => void
) {
  addLog('  → Applying transformations...')

  let data = [...bronzeData]
  const transformConfig = job.transformationConfig

  // Apply column mappings and type conversions
  if (transformConfig?.columnMappings) {
    data = data.map(row => {
      const newRow: any = {}

      transformConfig.columnMappings.forEach(mapping => {
        const sourceValue = row[mapping.sourceColumn]
        let value = sourceValue

        // Apply transformations
        if (mapping.transformations) {
          mapping.transformations.forEach(transform => {
            switch (transform.type) {
              case 'uppercase':
                value = value?.toString().toUpperCase()
                break
              case 'lowercase':
                value = value?.toString().toLowerCase()
                break
              case 'trim':
                value = value?.toString().trim()
                break
            }
          })
        }

        newRow[mapping.targetColumn] = value
      })

      return newRow
    })

    addLog(`  → Transformed ${transformConfig.columnMappings.length} columns`)
  }

  // Apply data quality rules
  const validationConfig = job.validationConfig
  let validRecords = data

  if (validationConfig?.dataQualityRules) {
    validRecords = data.filter(row => {
      for (const rule of validationConfig.dataQualityRules) {
        const value = row[rule.column]

        switch (rule.ruleType) {
          case 'not_null':
            if (!value || value.toString().trim() === '') {
              return false
            }
            break
          case 'range':
            const numValue = parseFloat(value)
            if (rule.parameters?.min !== undefined && numValue < rule.parameters.min) {
              return false
            }
            if (rule.parameters?.max !== undefined && numValue > rule.parameters.max) {
              return false
            }
            break
        }
      }
      return true
    })

    const rejected = data.length - validRecords.length
    if (rejected > 0) {
      addLog(`  ⚠ Validation: ${rejected} records rejected`)
    }
  }

  // Create schema with proper types
  const schema: ColumnSchema[] = transformConfig?.columnMappings
    ? transformConfig.columnMappings.map(mapping => ({
        name: mapping.targetColumn,
        type: mapping.dataType as any
      }))
    : bronzeSchema

  // Write to Parquet
  const tableName = job.destinationConfig.silverConfig?.tableName || 'silver_data'
  const outputPath = `data/silver/${job.workflowId}/${job.id}/${tableName}.parquet`

  writeParquet(validRecords, schema, outputPath)

  addLog(`  ✓ Silver layer saved: ${validRecords.length} records`)

  return {
    data: validRecords,
    schema,
    recordCount: validRecords.length,
    filePath: outputPath
  }
}

/**
 * Gold Layer: Business aggregations and derived metrics
 */
async function processGoldLayer(
  job: Job,
  silverData: any[],
  silverSchema: ColumnSchema[],
  addLog: (message: string) => void
) {
  addLog('  → Creating business-ready dataset...')

  // For now, Gold = Silver (will add aggregations later)
  // In production, this would include:
  // - GROUP BY aggregations
  // - Derived columns
  // - Business rules
  // - Denormalization

  let goldData = [...silverData]

  // Write to Parquet
  const tableName = job.destinationConfig.goldConfig?.tableName || 'gold_data'
  const outputPath = `data/gold/${job.workflowId}/${job.id}/${tableName}.parquet`

  writeParquet(goldData, silverSchema, outputPath)

  addLog(`  ✓ Gold layer saved: ${goldData.length} records`)

  return {
    data: goldData,
    schema: silverSchema,
    recordCount: goldData.length,
    filePath: outputPath
  }
}
