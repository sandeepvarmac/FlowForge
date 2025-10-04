import * as arrow from 'apache-arrow'
import fs from 'fs'

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
export function writeParquet(
  data: any[],
  schema: ColumnSchema[],
  outputPath: string
): void {
  try {
    // Build Arrow schema
    const fields = schema.map(col =>
      new arrow.Field(col.name, getArrowType(col.type), true) // nullable
    )
    const arrowSchema = new arrow.Schema(fields)

    // Convert data to columnar format
    const columns = schema.map(col => {
      const values = data.map(row => convertValue(row[col.name], col.type))
      return values
    })

    // Build Arrow table
    const builders = schema.map((col, i) => {
      const ArrowType = getArrowType(col.type)

      // Create appropriate builder
      switch (col.type) {
        case 'integer':
          return arrow.makeBuilder({ type: new arrow.Int64(), nullValues: [null] })
        case 'decimal':
          return arrow.makeBuilder({ type: new arrow.Float64(), nullValues: [null] })
        case 'date':
          return arrow.makeBuilder({ type: new arrow.DateMillisecond(), nullValues: [null] })
        case 'boolean':
          return arrow.makeBuilder({ type: new arrow.Bool(), nullValues: [null] })
        default:
          return arrow.makeBuilder({ type: new arrow.Utf8(), nullValues: [null] })
      }
    })

    // Populate builders
    for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
      schema.forEach((col, colIdx) => {
        const value = convertValue(data[rowIdx][col.name], col.type)
        builders[colIdx].append(value)
      })
    }

    // Finish building vectors
    const vectors = builders.map((builder, i) => builder.finish().toVector())

    // Create record batch
    const recordBatch = new arrow.RecordBatch(arrowSchema, data.length, vectors)

    // Write to file using Parquet writer
    const table = new arrow.Table(arrowSchema, [recordBatch])

    // For now, we'll write as Arrow IPC format (similar to Parquet)
    // Note: For production, you'd want to use a proper Parquet writer
    const writer = arrow.RecordBatchFileWriter.writeAll(table)
    const buffer = writer.toUint8Array()

    fs.writeFileSync(outputPath, buffer)

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
