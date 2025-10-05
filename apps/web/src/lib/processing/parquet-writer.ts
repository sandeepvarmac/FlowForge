import * as arrow from 'apache-arrow'
import { tableFromArrays } from 'apache-arrow'
import fs from 'fs'
import path from 'path'

export interface ColumnSchema {
  name: string
  type: 'string' | 'integer' | 'decimal' | 'date' | 'boolean'
}

/**
 * Convert JavaScript type to Arrow type
 */
function getArrowType(type: string): arrow.DataType {
  switch (type) {
    case 'integer':
      return new arrow.Int64()
    case 'decimal':
      return new arrow.Float64()
    case 'date':
      return new arrow.DateMillisecond()
    case 'boolean':
      return new arrow.Bool()
    case 'string':
    default:
      return new arrow.Utf8()
  }
}

/**
 * Convert value to appropriate type
 */
function convertValue(value: any, type: string): any {
  if (value === null || value === undefined || value === '') {
    return null
  }

  switch (type) {
    case 'integer':
      const intVal = parseInt(value)
      return isNaN(intVal) ? null : BigInt(intVal)
    case 'decimal':
      const floatVal = parseFloat(value)
      return isNaN(floatVal) ? null : floatVal
    case 'date':
      const date = new Date(value)
      return isNaN(date.getTime()) ? null : date.getTime()
    case 'boolean':
      return value === 'true' || value === '1' || value === true
    case 'string':
    default:
      return String(value)
  }
}

/**
 * Write data to Parquet file
 */
export async function writeParquet(
  data: any[],
  schema: ColumnSchema[],
  outputPath: string
): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(outputPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    // Convert data to columnar format for Arrow
    const columns: Record<string, any[]> = {}
    schema.forEach(col => {
      columns[col.name] = data.map(row => convertValue(row[col.name], col.type))
    })

    // Create Arrow table
    const table = tableFromArrays(columns) as any

    // Write to Parquet using parquet-wasm Node.js build (avoids WASM bundling issues)
    const { writeParquet: writeParquetWasm } = await import('parquet-wasm/node')
    const parquetBuffer = writeParquetWasm(table as any)

    // Write buffer to file
    fs.writeFileSync(outputPath, Buffer.from(parquetBuffer))

    console.log(`✅ Parquet file written: ${outputPath} (${data.length} rows)`)
  } catch (error) {
    console.error('❌ Error writing Parquet file:', error)
    throw error
  }
}

/**
 * Read Parquet file (Arrow IPC format)
 */
export function readParquet(filepath: string): any[] {
  try {
    const buffer = fs.readFileSync(filepath)
    const table = arrow.tableFromIPC(buffer)

    const data: any[] = []
    for (const row of table) {
      const obj: any = {}
      table.schema.fields.forEach((field, i) => {
        obj[field.name] = row[i]
      })
      data.push(obj)
    }

    console.log(`✅ Parquet file read: ${filepath} (${data.length} rows)`)
    return data
  } catch (error) {
    console.error('❌ Error reading Parquet file:', error)
    throw error
  }
}
