/**
 * DuckDB Integration for Gold Layer Analytics
 * Provides Snowflake Schema with dimension and fact tables
 */

import { Database } from 'duckdb-async'
import path from 'path'
import fs from 'fs'

/**
 * Get or create DuckDB instance (creates a NEW connection each time)
 */
export async function getDuckDB(): Promise<Database> {
  const dbPath = path.join(process.cwd(), 'data', 'duckdb', 'gold.duckdb')
  const dbDir = path.dirname(dbPath)

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Always create a new connection to avoid file locks
  return await Database.create(dbPath)
}

/**
 * Close DuckDB connection
 */
export async function closeDuckDB(database: Database): Promise<void> {
  try {
    await database.close()
  } catch (error) {
    console.error('Error closing DuckDB:', error)
  }
}

/**
 * Execute SQL query on DuckDB
 */
export async function executeDuckDBQuery(sql: string, params?: any[]): Promise<any[]> {
  const duckdb = await getDuckDB()
  try {
    const result = await duckdb.all(sql, ...(params || []))
    return result
  } finally {
    await closeDuckDB(duckdb)
  }
}

/**
 * Create Snowflake Schema tables in DuckDB
 */
export async function createSnowflakeSchema(): Promise<void> {
  // Create dimension: dim_country
  await executeDuckDBQuery(`
    CREATE TABLE IF NOT EXISTS dim_country (
      country_key INTEGER PRIMARY KEY,
      country_code VARCHAR,
      country_name VARCHAR,
      region VARCHAR,
      currency_code VARCHAR,
      phone_code VARCHAR,
      valid_from TIMESTAMP,
      valid_to TIMESTAMP,
      is_current BOOLEAN
    )
  `)

  // Create dimension: dim_customer
  await executeDuckDBQuery(`
    CREATE TABLE IF NOT EXISTS dim_customer (
      customer_key INTEGER PRIMARY KEY,
      customer_id VARCHAR,
      first_name VARCHAR,
      last_name VARCHAR,
      email VARCHAR,
      phone VARCHAR,
      country_key INTEGER,
      loyalty_tier VARCHAR,
      valid_from TIMESTAMP,
      valid_to TIMESTAMP,
      is_current BOOLEAN,
      FOREIGN KEY (country_key) REFERENCES dim_country(country_key)
    )
  `)

  // Create dimension: dim_product
  await executeDuckDBQuery(`
    CREATE TABLE IF NOT EXISTS dim_product (
      product_key INTEGER PRIMARY KEY,
      product_id VARCHAR,
      product_name VARCHAR,
      category VARCHAR,
      subcategory VARCHAR,
      unit_price DECIMAL(10, 2),
      valid_from TIMESTAMP,
      valid_to TIMESTAMP,
      is_current BOOLEAN
    )
  `)

  // Create fact: fact_orders
  await executeDuckDBQuery(`
    CREATE TABLE IF NOT EXISTS fact_orders (
      order_key INTEGER PRIMARY KEY,
      order_id VARCHAR,
      customer_key INTEGER,
      product_key INTEGER,
      order_date DATE,
      quantity INTEGER,
      unit_price DECIMAL(10, 2),
      discount_percent DECIMAL(5, 2),
      total_amount DECIMAL(10, 2),
      FOREIGN KEY (customer_key) REFERENCES dim_customer(customer_key),
      FOREIGN KEY (product_key) REFERENCES dim_product(product_key)
    )
  `)

  console.log('Snowflake schema created in DuckDB')
}

/**
 * Load dimension table from Silver Parquet file
 */
export async function loadDimensionFromParquet(
  dimensionName: 'dim_country' | 'dim_customer' | 'dim_product',
  parquetFilePath: string,
  columnMappings: Record<string, string>,
  surrogateKeyColumn: string = '_sk_id'
): Promise<number> {
  const columns = Object.entries(columnMappings)
    .map(([source, target]) => `${source} AS ${target}`)
    .join(', ')

  const sql = `
    INSERT INTO ${dimensionName}
    SELECT
      ${surrogateKeyColumn} AS ${dimensionName === 'dim_country' ? 'country_key' : dimensionName === 'dim_customer' ? 'customer_key' : 'product_key'},
      ${columns},
      CURRENT_TIMESTAMP AS valid_from,
      TIMESTAMP '9999-12-31 23:59:59' AS valid_to,
      TRUE AS is_current
    FROM read_parquet('${parquetFilePath}')
  `

  await executeDuckDBQuery(sql)

  const countResult = await executeDuckDBQuery(`SELECT COUNT(*) as count FROM ${dimensionName}`)
  return countResult[0].count
}

/**
 * Load fact table from Silver Parquet with dimension lookups
 */
export async function loadFactFromParquet(
  factName: 'fact_orders',
  parquetFilePath: string,
  columnMappings: Record<string, string>,
  dimensionLookups: {
    customer: { column: string; lookupColumn: string }
    product: { column: string; lookupColumn: string }
  },
  surrogateKeyColumn: string = '_sk_id'
): Promise<number> {
  const columns = Object.entries(columnMappings)
    .map(([source, target]) => `f.${source} AS ${target}`)
    .join(', ')

  const sql = `
    INSERT INTO ${factName}
    SELECT
      f.${surrogateKeyColumn} AS order_key,
      ${columns},
      c.customer_key,
      p.product_key
    FROM read_parquet('${parquetFilePath}') f
    LEFT JOIN dim_customer c ON f.${dimensionLookups.customer.column} = c.${dimensionLookups.customer.lookupColumn} AND c.is_current = TRUE
    LEFT JOIN dim_product p ON f.${dimensionLookups.product.column} = p.${dimensionLookups.product.lookupColumn} AND p.is_current = TRUE
  `

  await executeDuckDBQuery(sql)

  const countResult = await executeDuckDBQuery(`SELECT COUNT(*) as count FROM ${factName}`)
  return countResult[0].count
}

/**
 * Truncate all tables (for fresh reload)
 */
export async function truncateAllTables(): Promise<void> {
  await executeDuckDBQuery('DELETE FROM fact_orders')
  await executeDuckDBQuery('DELETE FROM dim_customer')
  await executeDuckDBQuery('DELETE FROM dim_product')
  await executeDuckDBQuery('DELETE FROM dim_country')
  console.log('All DuckDB tables truncated')
}

/**
 * Export DuckDB table to Parquet for Gold layer storage
 */
export async function exportTableToParquet(
  tableName: string,
  outputPath: string
): Promise<void> {
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  await executeDuckDBQuery(`
    COPY (SELECT * FROM ${tableName})
    TO '${outputPath}'
    (FORMAT PARQUET, COMPRESSION ZSTD)
  `)

  console.log(`Exported ${tableName} to ${outputPath}`)
}

