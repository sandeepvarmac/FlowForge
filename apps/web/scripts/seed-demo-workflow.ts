/**
 * Seed Demo Workflow with Snowflake Schema Jobs
 *
 * This script creates a complete demo workflow with 5 jobs:
 * 1. Load Countries (Reference Data) → dim_country
 * 2. Load Customers (with country lookup) → dim_customer
 * 3. Load Products (Catalog Data) → dim_product
 * 4. Load Orders (Transactional Data) → fact_orders
 * 5. Gold Analytics (Consolidate Snowflake Schema)
 */

import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const dbPath = path.join(process.cwd(), 'data', 'flowforge.db')

// Ensure data directory exists
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(dbPath)

console.log('🌱 Seeding demo workflow...')

// Initialize database with schema
const { SCHEMA } = require('../src/lib/db/schema')
db.exec(SCHEMA)

console.log('✅ Database initialized')

// 1. Create demo workflow
const workflowResult = db.prepare(`
  INSERT INTO workflows (id, name, description, application, owner, status, type, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'demo-snowflake-001',
  'E-Commerce Snowflake Schema Demo',
  'End-to-end data pipeline: Bronze → Silver → Gold with Snowflake Schema (3 Dimensions + 1 Fact)',
  'Demo Application',
  'Data Engineering Team',
  'manual',
  'manual',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created workflow:', workflowResult.changes)

// 2. Job 1: Load Countries (Reference Data)
const job1 = db.prepare(`
  INSERT INTO jobs (
    id, workflow_id, name, description, type, order_index,
    source_config, destination_config, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'job-countries-001',
  'demo-snowflake-001',
  'Load Countries (Reference)',
  'Load country reference data into dim_country dimension',
  'file-based',
  1,
  JSON.stringify({
    name: 'countries.csv',
    type: 'csv',
    connection: {},
    fileConfig: {
      filePath: 'sample-data/countries.csv',
      uploadMode: 'single',
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      skipRows: 0,
      compressionType: 'none'
    }
  }),
  JSON.stringify({
    bronzeConfig: {
      enabled: true,
      tableName: 'bronze_countries',
      storageFormat: 'parquet',
      loadStrategy: 'append',
      auditColumns: true
    },
    silverConfig: {
      enabled: true,
      tableName: 'silver_countries',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      primaryKey: 'country_code',
      surrogateKeyStrategy: 'auto_increment'
    },
    goldConfig: {
      enabled: true,
      tableName: 'dim_country',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }),
  'configured',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created Job 1: Load Countries')

// 3. Job 2: Load Customers (Main Entity)
const job2 = db.prepare(`
  INSERT INTO jobs (
    id, workflow_id, name, description, type, order_index,
    source_config, destination_config, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'job-customers-001',
  'demo-snowflake-001',
  'Load Customers',
  'Load customer data with deduplication and merge into dim_customer',
  'file-based',
  2,
  JSON.stringify({
    name: 'customers.csv',
    type: 'csv',
    connection: {},
    fileConfig: {
      filePath: 'sample-data/customers.csv',
      filePattern: 'customer*.csv',
      uploadMode: 'pattern',
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      skipRows: 0,
      compressionType: 'none'
    }
  }),
  JSON.stringify({
    bronzeConfig: {
      enabled: true,
      tableName: 'bronze_customers',
      storageFormat: 'parquet',
      loadStrategy: 'append',
      auditColumns: true
    },
    silverConfig: {
      enabled: true,
      tableName: 'silver_customers',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      primaryKey: 'customer_id',
      surrogateKeyStrategy: 'auto_increment'
    },
    goldConfig: {
      enabled: true,
      tableName: 'dim_customer',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }),
  'configured',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created Job 2: Load Customers')

// 4. Job 3: Load Products (Catalog)
const job3 = db.prepare(`
  INSERT INTO jobs (
    id, workflow_id, name, description, type, order_index,
    source_config, destination_config, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'job-products-001',
  'demo-snowflake-001',
  'Load Products',
  'Load product catalog into dim_product dimension',
  'file-based',
  3,
  JSON.stringify({
    name: 'products.csv',
    type: 'csv',
    connection: {},
    fileConfig: {
      filePath: 'sample-data/products.csv',
      uploadMode: 'single',
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      skipRows: 0,
      compressionType: 'none'
    }
  }),
  JSON.stringify({
    bronzeConfig: {
      enabled: true,
      tableName: 'bronze_products',
      storageFormat: 'parquet',
      loadStrategy: 'append',
      auditColumns: true
    },
    silverConfig: {
      enabled: true,
      tableName: 'silver_products',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      primaryKey: 'product_id',
      surrogateKeyStrategy: 'auto_increment'
    },
    goldConfig: {
      enabled: true,
      tableName: 'dim_product',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }),
  'configured',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created Job 3: Load Products')

// 5. Job 4: Load Orders (Fact Table)
const job4 = db.prepare(`
  INSERT INTO jobs (
    id, workflow_id, name, description, type, order_index,
    source_config, destination_config, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'job-orders-001',
  'demo-snowflake-001',
  'Load Orders',
  'Load transactional orders into fact_orders with dimension lookups',
  'file-based',
  4,
  JSON.stringify({
    name: 'orders.csv',
    type: 'csv',
    connection: {},
    fileConfig: {
      filePath: 'sample-data/orders.csv',
      uploadMode: 'single',
      encoding: 'utf-8',
      delimiter: ',',
      hasHeader: true,
      skipRows: 0,
      compressionType: 'none'
    }
  }),
  JSON.stringify({
    bronzeConfig: {
      enabled: true,
      tableName: 'bronze_orders',
      storageFormat: 'parquet',
      loadStrategy: 'append',
      auditColumns: true
    },
    silverConfig: {
      enabled: true,
      tableName: 'silver_orders',
      storageFormat: 'parquet',
      mergeStrategy: 'merge',
      primaryKey: 'order_id',
      surrogateKeyStrategy: 'auto_increment'
    },
    goldConfig: {
      enabled: true,
      tableName: 'fact_orders',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }),
  'configured',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created Job 4: Load Orders')

// 6. Job 5: Gold Analytics (Snowflake Schema Consolidation)
const job5 = db.prepare(`
  INSERT INTO jobs (
    id, workflow_id, name, description, type, order_index,
    source_config, destination_config, status, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  'job-gold-analytics-001',
  'demo-snowflake-001',
  'Gold Analytics Layer',
  'Consolidate Snowflake Schema: Export all dimensions and fact table to Parquet',
  'gold-analytics',
  5,
  JSON.stringify({
    name: 'Gold Analytics',
    type: 'internal',
    connection: {}
  }),
  JSON.stringify({
    bronzeConfig: {
      enabled: false,
      tableName: '',
      storageFormat: 'parquet'
    },
    silverConfig: {
      enabled: false,
      tableName: '',
      storageFormat: 'parquet'
    },
    goldConfig: {
      enabled: true,
      tableName: 'snowflake_schema',
      storageFormat: 'parquet',
      refreshStrategy: 'full_rebuild',
      compression: 'zstd'
    }
  }),
  'configured',
  new Date().toISOString(),
  new Date().toISOString()
)

console.log('✅ Created Job 5: Gold Analytics')

db.close()

console.log('\n✅ Demo workflow seeded successfully!')
console.log('\n📊 Workflow: E-Commerce Snowflake Schema Demo')
console.log('   - Job 1: Load Countries → dim_country')
console.log('   - Job 2: Load Customers → dim_customer (pattern: customer*.csv)')
console.log('   - Job 3: Load Products → dim_product')
console.log('   - Job 4: Load Orders → fact_orders')
console.log('   - Job 5: Gold Analytics → Export Snowflake Schema')
console.log('\n🚀 Ready to run the demo workflow!')
