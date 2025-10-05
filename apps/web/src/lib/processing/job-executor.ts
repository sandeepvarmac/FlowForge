import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import { tableFromArrays } from 'apache-arrow'
import { getDatabase } from '../db'
import { saveParquetFile, readFile, fileExists, getCurrentSilverFile } from '../storage'
import { writeParquet, readParquet as readParquetFile, type ColumnSchema } from './parquet-writer'
import { scanFilesWithPattern, scanSingleFile, type ScannedFile } from '../storage/file-scanner'
import {
  createSnowflakeSchema,
  loadDimensionFromParquet,
  loadFactFromParquet,
  truncateAllTables,
  exportTableToParquet,
  executeDuckDBQuery
} from '../duckdb'
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

    // Note: Execution record is now created by the workflow run API
    // This function focuses only on data processing

    // Determine source files (pattern matching or single file)
    let sourceFiles: ScannedFile[] = []
    const fileConfig = job.sourceConfig.fileConfig

    if (fileConfig?.uploadMode === 'pattern' && fileConfig?.filePattern) {
      // Pattern matching mode
      const directory = path.dirname(sourceFilePath)

      // Check if directory exists
      if (!fs.existsSync(directory)) {
        throw new Error(`Source directory does not exist: ${directory}`)
      }

      const pattern = fileConfig.filePattern
      addLog(`📂 Scanning for files matching pattern: ${pattern}`)
      sourceFiles = await scanFilesWithPattern(directory, pattern)
      addLog(`✓ Found ${sourceFiles.length} files to process`)
    } else {
      // Single file mode
      // Check if source file exists
      if (!fs.existsSync(sourceFilePath)) {
        throw new Error(`Source file does not exist: ${sourceFilePath}`)
      }

      const scannedFile = scanSingleFile(sourceFilePath)
      if (scannedFile) {
        sourceFiles = [scannedFile]
      }
    }

    if (sourceFiles.length === 0) {
      throw new Error(`No source files found to process. Pattern: ${fileConfig?.filePattern || 'single file'}, Path: ${sourceFilePath}`)
    }

    // Step 1: Bronze Layer - Process all source files
    addLog(`📥 Step 1: Processing Bronze Layer (${sourceFiles.length} file(s))`)
    const bronzeResult = await processBronzeLayer(job, sourceFiles, addLog)

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

    // Calculate duration
    const endTime = Date.now()
    const duration = endTime - startTime

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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    addLog(`❌ Job execution failed: ${errorMessage}`)

    // Re-throw the error so the run route can handle it
    throw error
  }
}

/**
 * Bronze Layer: Read CSV files and convert to Parquet (raw data with timestamp versioning)
 * Supports multiple files for pattern matching
 */
async function processBronzeLayer(
  job: Job,
  sourceFiles: ScannedFile[],
  addLog: (message: string) => void
) {
  const bronzeConfig = job.destinationConfig.bronzeConfig
  const tableName = bronzeConfig?.tableName || 'bronze_data'

  let allData: any[] = []
  let schema: ColumnSchema[] = []
  const versionedPaths: string[] = []

  // Process each file
  for (let i = 0; i < sourceFiles.length; i++) {
    const file = sourceFiles[i]
    addLog(`  → Processing file ${i + 1}/${sourceFiles.length}: ${file.filename}`)

    // Read file content
    let fileContent: string
    try {
      fileContent = readFile(file.filepath).toString('utf-8')
    } catch (error) {
      throw new Error(`Failed to read file ${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // Parse CSV
    const parseResult = Papa.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false // Keep as strings for Bronze
    })

    // Check for parsing errors
    if (parseResult.errors && parseResult.errors.length > 0) {
      const errorMessages = parseResult.errors.slice(0, 3).map(e => e.message).join('; ')
      addLog(`  ⚠ Warning: CSV parsing had ${parseResult.errors.length} error(s): ${errorMessages}`)
    }

    let fileData = parseResult.data as any[]
    const headers = parseResult.meta.fields || []

    if (fileData.length === 0) {
      throw new Error(`File ${file.filename} contains no data rows`)
    }

    if (headers.length === 0) {
      throw new Error(`File ${file.filename} has no headers`)
    }

    addLog(`     → Parsed ${fileData.length} rows, ${headers.length} columns`)

    // Add audit columns if enabled (Bronze layer tracking)
    if (bronzeConfig?.auditColumns !== false) {
      const timestamp = new Date().toISOString()

      fileData = fileData.map((row, index) => ({
        ...row,
        _ingested_at: timestamp,
        _source_file: file.filename,
        _row_number: index + 1
      }))
    }

    // Create schema from first file (all subsequent files should match)
    if (i === 0) {
      schema = [
        ...headers.map(name => ({ name, type: 'string' as const })),
        ...(bronzeConfig?.auditColumns !== false ? [
          { name: '_ingested_at', type: 'string' as const },
          { name: '_source_file', type: 'string' as const },
          { name: '_row_number', type: 'integer' as const }
        ] : [])
      ]
    }

    // Write directly to Bronze using storage module (with timestamp versioning)
    try {
      // Create Arrow table from data
      const columns: Record<string, any[]> = {}
      schema.forEach(col => {
        columns[col.name] = fileData.map(row => {
          const value = row[col.name]
          if (col.type === 'integer') return value ? parseInt(value) : null
          if (col.type === 'decimal') return value ? parseFloat(value) : null
          if (col.type === 'boolean') return value === 'true' || value === true
          return value
        })
      })

      const table = tableFromArrays(columns) as any

      // Write to Parquet using parquet-wasm Node.js build (avoids WASM bundling issues)
      let writeParquetWasm: (table: any) => Uint8Array
      try {
        writeParquetWasm = (await import('parquet-wasm/node')).writeParquet
      } catch (error) {
        const fallback = await import('parquet-wasm')
        writeParquetWasm = fallback.writeParquet
      }
      const parquetBuffer = writeParquetWasm(table as any)

      // For pattern matching, include source filename in Bronze version
      const cleanFileName = file.filename.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9]/gi, '_')
      const versionedPath = saveParquetFile(
        'bronze',
        job.workflowId,
        job.id,
        `${tableName}_${cleanFileName}`,
        Buffer.from(parquetBuffer),
        { versioningStrategy: 'timestamp' }
      )

      addLog(`     ✓ Saved to Bronze: ${fileData.length} records → ${path.basename(versionedPath)}`)
      versionedPaths.push(versionedPath)
      allData = allData.concat(fileData)
    } catch (error) {
      throw new Error(`Failed to write Bronze Parquet for ${file.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  addLog(`  ✓ Bronze layer complete: ${allData.length} total records from ${sourceFiles.length} file(s)`)

  return {
    data: allData, // Combined data for Silver layer
    schema,
    recordCount: allData.length,
    filePath: versionedPaths[0] // Return first file path for reference
  }
}

/**
 * Silver Layer: Apply transformations, surrogate keys, and upsert logic
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
  const silverConfig = job.destinationConfig.silverConfig

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
              case 'email_normalize':
                value = value?.toString().toLowerCase().trim()
                break
              case 'phone_format':
                // Basic E.164 formatting
                value = value?.toString().replace(/\D/g, '')
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
      for (const rule of validationConfig.dataQualityRules!) {
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

  // Read existing Silver data for upsert/merge logic
  const tableName = silverConfig?.tableName || 'silver_data'
  const existingSilverPath = getCurrentSilverFile(job.workflowId, job.id, tableName)

  let existingData: any[] = []
  let nextSurrogateKey = 1

  if (existingSilverPath) {
    try {
      existingData = readParquetFile(existingSilverPath)
      // Find max surrogate key
      const maxKey = Math.max(...existingData.map(r => r._sk_id || 0), 0)
      nextSurrogateKey = maxKey + 1
      addLog(`  → Loaded ${existingData.length} existing records (max SK: ${maxKey})`)
    } catch (error) {
      addLog(`  ⚠ Could not read existing Silver file, starting fresh`)
    }
  }

  // Add surrogate keys to new records
  const primaryKeyCol = silverConfig?.primaryKey || 'id'
  const dataWithSK = validRecords.map((row, index) => ({
    _sk_id: nextSurrogateKey + index,
    ...row
  }))

  addLog(`  → Generated surrogate keys: ${nextSurrogateKey} - ${nextSurrogateKey + validRecords.length - 1}`)

  // Perform upsert/merge
  let mergedData: any[]

  if (existingData.length > 0 && silverConfig?.mergeStrategy === 'merge') {
    // Create a map of existing records by primary key
    const existingMap = new Map(existingData.map(r => [r[primaryKeyCol], r]))

    // Upsert logic: Update existing, insert new
    dataWithSK.forEach(newRow => {
      const key = newRow[primaryKeyCol]
      if (existingMap.has(key)) {
        // Update existing record (keep same SK)
        const existing = existingMap.get(key)
        existingMap.set(key, { ...existing, ...newRow, _sk_id: existing._sk_id })
      } else {
        // Insert new record
        existingMap.set(key, newRow)
      }
    })

    mergedData = Array.from(existingMap.values())
    addLog(`  → Merged: ${mergedData.length} total records (${dataWithSK.length} new/updated)`)
  } else {
    // Full refresh mode
    mergedData = dataWithSK
    addLog(`  → Full refresh: ${mergedData.length} records`)
  }

  // Create schema with surrogate key + proper types
  const schema: ColumnSchema[] = [
    { name: '_sk_id', type: 'integer' },
    ...(transformConfig?.columnMappings
      ? transformConfig.columnMappings.map(mapping => ({
          name: mapping.targetColumn,
          type: mapping.dataType as any
        }))
      : bronzeSchema.filter(s => !s.name.startsWith('_'))) // Exclude Bronze audit columns
  ]

  // Write directly to Silver using storage module (with current + archive strategy)
  let versionedPath: string
  try {
    // Create Arrow table from data
    const columns: Record<string, any[]> = {}
    schema.forEach(col => {
      columns[col.name] = mergedData.map(row => {
        const value = row[col.name]
        if (col.type === 'integer') return value ? parseInt(value) : null
        if (col.type === 'decimal') return value ? parseFloat(value) : null
        if (col.type === 'boolean') return value === 'true' || value === true
        return value
      })
    })

    const table = tableFromArrays(columns) as any

    // Write to Parquet using parquet-wasm Node.js build (avoids WASM bundling issues)
    let writeParquetWasm: (table: any) => Uint8Array
    try {
      writeParquetWasm = (await import('parquet-wasm/node')).writeParquet
    } catch (error) {
      const fallback = await import('parquet-wasm')
      writeParquetWasm = fallback.writeParquet
    }
    const parquetBuffer = writeParquetWasm(table as any)

    versionedPath = saveParquetFile(
      'silver',
      job.workflowId,
      job.id,
      tableName,
      Buffer.from(parquetBuffer),
      { versioningStrategy: 'current' }
    )

    addLog(`  ✓ Silver layer saved: ${mergedData.length} records → ${versionedPath}`)
  } catch (error) {
    throw new Error(`Failed to write Silver Parquet: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    data: mergedData,
    schema,
    recordCount: mergedData.length,
    filePath: versionedPath
  }
}

/**
 * Gold Layer: DuckDB Snowflake Schema with Dimensions and Fact Tables
 */
async function processGoldLayer(
  job: Job,
  silverData: any[],
  silverSchema: ColumnSchema[],
  addLog: (message: string) => void
) {
  const goldConfig = job.destinationConfig.goldConfig
  const jobType = job.type

  // Check if this is a Gold Analytics job (combines all dimensions into fact table)
  if (jobType === 'gold-analytics') {
    return await processGoldAnalytics(job, addLog)
  }

  // Otherwise, process as dimension/fact source job
  addLog('  → Loading to Gold layer (DuckDB Snowflake Schema)...')

  // Ensure Snowflake schema exists
  await createSnowflakeSchema()

  const tableName = goldConfig?.tableName || 'gold_data'
  const silverTableName = job.destinationConfig.silverConfig?.tableName || 'silver_data'

  // Determine Silver file path
  const silverFilePath = getCurrentSilverFile(job.workflowId, job.id, silverTableName)

  if (!silverFilePath) {
    throw new Error(`Silver file not found for Gold layer processing. Expected at: data/silver/${job.workflowId}/${job.id}/${silverTableName}/current.parquet`)
  }

  // Verify file actually exists
  if (!fs.existsSync(silverFilePath)) {
    throw new Error(`Silver file path resolved but file does not exist: ${silverFilePath}`)
  }

  addLog(`  → Using Silver file: ${silverFilePath}`)

  let recordCount = 0

  // Load dimension or fact based on job configuration
  if (job.name.toLowerCase().includes('country') || tableName.includes('country')) {
    // Load dim_country
    addLog('  → Loading dim_country...')
    recordCount = await loadDimensionFromParquet(
      'dim_country',
      silverFilePath,
      {
        country_code: 'country_code',
        name: 'country_name',
        region: 'region',
        currency_code: 'currency_code',
        phone_code: 'phone_code'
      }
    )
    addLog(`  ✓ Loaded ${recordCount} records into dim_country`)

  } else if (job.name.toLowerCase().includes('customer') || tableName.includes('customer')) {
    // Load dim_customer
    addLog('  → Loading dim_customer...')

    // Need to join with dim_country for country_key
    const sql = `
      INSERT INTO dim_customer
      SELECT
        f._sk_id AS customer_key,
        f.customer_id,
        f.first_name,
        f.last_name,
        f.email,
        f.phone,
        c.country_key,
        f.loyalty_tier,
        CURRENT_TIMESTAMP AS valid_from,
        TIMESTAMP '9999-12-31 23:59:59' AS valid_to,
        TRUE AS is_current
      FROM read_parquet('${silverFilePath}') f
      LEFT JOIN dim_country c ON f.country = c.country_code AND c.is_current = TRUE
    `

    await executeDuckDBQuery(sql)

    const countResult = await executeDuckDBQuery('SELECT COUNT(*) as count FROM dim_customer')
    recordCount = countResult[0].count
    addLog(`  ✓ Loaded ${recordCount} records into dim_customer`)

  } else if (job.name.toLowerCase().includes('product') || tableName.includes('product')) {
    // Load dim_product
    addLog('  → Loading dim_product...')
    recordCount = await loadDimensionFromParquet(
      'dim_product',
      silverFilePath,
      {
        product_id: 'product_id',
        product_name: 'product_name',
        category: 'category',
        subcategory: 'subcategory',
        unit_price: 'unit_price'
      }
    )
    addLog(`  ✓ Loaded ${recordCount} records into dim_product`)

  } else if (job.name.toLowerCase().includes('order') || tableName.includes('order')) {
    // Load fact_orders
    addLog('  → Loading fact_orders...')
    recordCount = await loadFactFromParquet(
      'fact_orders',
      silverFilePath,
      {
        order_id: 'order_id',
        order_date: 'order_date',
        quantity: 'quantity',
        unit_price: 'unit_price',
        discount_percent: 'discount_percent',
        total_amount: 'total_amount'
      },
      {
        customer: { column: 'customer_id', lookupColumn: 'customer_id' },
        product: { column: 'product_id', lookupColumn: 'product_id' }
      }
    )
    addLog(`  ✓ Loaded ${recordCount} records into fact_orders`)
  }

  // Export DuckDB table to Parquet for storage
  const outputPath = `data/gold/${job.workflowId}/${job.id}/${tableName}.parquet`
  await exportTableToParquet(tableName.startsWith('dim_') || tableName.startsWith('fact_') ? tableName : `gold_${tableName}`, outputPath)

  addLog(`  ✓ Gold layer complete: ${recordCount} records`)

  return {
    data: [],
    schema: silverSchema,
    recordCount,
    filePath: outputPath
  }
}

/**
 * Gold Analytics Job: Combines all dimensions and facts into final analytics layer
 */
async function processGoldAnalytics(
  job: Job,
  addLog: (message: string) => void
) {
  addLog('  → Running Gold Analytics (Snowflake Schema complete)...')

  // Ensure schema exists
  await createSnowflakeSchema()

  // Get counts from all tables
  const countryCount = await executeDuckDBQuery('SELECT COUNT(*) as count FROM dim_country')
  const customerCount = await executeDuckDBQuery('SELECT COUNT(*) as count FROM dim_customer')
  const productCount = await executeDuckDBQuery('SELECT COUNT(*) as count FROM dim_product')
  const orderCount = await executeDuckDBQuery('SELECT COUNT(*) as count FROM fact_orders')

  addLog(`  ✓ Snowflake Schema loaded:`)
  addLog(`    - dim_country: ${countryCount[0].count} records`)
  addLog(`    - dim_customer: ${customerCount[0].count} records`)
  addLog(`    - dim_product: ${productCount[0].count} records`)
  addLog(`    - fact_orders: ${orderCount[0].count} records`)

  // Export all tables to Parquet
  const workflowDir = `data/gold/${job.workflowId}/${job.id}`
  await exportTableToParquet('dim_country', `${workflowDir}/dim_country.parquet`)
  await exportTableToParquet('dim_customer', `${workflowDir}/dim_customer.parquet`)
  await exportTableToParquet('dim_product', `${workflowDir}/dim_product.parquet`)
  await exportTableToParquet('fact_orders', `${workflowDir}/fact_orders.parquet`)

  addLog(`  ✓ All tables exported to Parquet`)

  return {
    data: [],
    schema: [],
    recordCount: orderCount[0].count,
    filePath: `${workflowDir}/fact_orders.parquet`
  }
}
