/**
 * Seed Script: Create sample data assets for testing
 * Run with: npx tsx scripts/seed-data-assets.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const DB_PATH = path.join(process.cwd(), 'data', 'flowforge.db');

function seedDataAssets() {
  console.log('Seeding data assets...');
  console.log('Database path:', DB_PATH);

  const db = new Database(DB_PATH);

  try {
    // Get existing workflow and job for foreign key
    const workflow = db.prepare('SELECT id FROM workflows LIMIT 1').get() as any;
    const job = db.prepare('SELECT id FROM jobs LIMIT 1').get() as any;

    if (!workflow || !job) {
      console.log('⚠ No workflows/jobs found. Creating sample workflow first...');

      // Create sample workflow
      const workflowId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO workflows (id, name, description, application, owner, status, type, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        workflowId,
        'E-Commerce Data Pipeline',
        'Sample workflow for data assets demo',
        'E-Commerce',
        'admin@flowforge.com',
        'manual',
        'manual',
        Date.now(),
        Date.now()
      );

      // Create sample jobs
      const bronzeJobId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO jobs (id, workflow_id, name, description, type, order_index, status, source_config, destination_config, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        bronzeJobId,
        workflowId,
        'Load Customer Data',
        'Load customer data to Bronze layer',
        'file-based',
        1,
        'ready',
        JSON.stringify({ type: 'csv', path: 'landing/customers/' }),
        JSON.stringify({ layer: 'bronze', table: 'customers_raw' }),
        Date.now(),
        Date.now()
      );

      console.log('✓ Created sample workflow and jobs');
    }

    // Get job for assets
    const assetJob = db.prepare('SELECT id, workflow_id FROM jobs LIMIT 1').get() as any;

    // Sample data assets
    const assets = [
      // Bronze Layer - Production
      {
        id: crypto.randomUUID(),
        layer: 'bronze',
        table_name: 'customers_raw',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'customer_id', type: 'INTEGER', nullable: false },
          { name: 'first_name', type: 'VARCHAR', nullable: true },
          { name: 'last_name', type: 'VARCHAR', nullable: true },
          { name: 'email', type: 'VARCHAR', nullable: true },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
        ]),
        row_count: 125000,
        file_size: 8 * 1024 * 1024, // 8 MB
        file_path: 's3://flowforge/bronze/customers_raw/data.parquet',
        parent_tables: null,
        description: 'Raw customer data from source system',
        tags: JSON.stringify(['customers', 'bronze', 'raw']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        updated_at: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      },
      {
        id: crypto.randomUUID(),
        layer: 'bronze',
        table_name: 'orders_raw',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'order_id', type: 'INTEGER', nullable: false },
          { name: 'customer_id', type: 'INTEGER', nullable: false },
          { name: 'order_date', type: 'DATE', nullable: false },
          { name: 'total_amount', type: 'DECIMAL', nullable: false },
          { name: 'status', type: 'VARCHAR', nullable: true },
        ]),
        row_count: 450000,
        file_size: 15 * 1024 * 1024, // 15 MB
        file_path: 's3://flowforge/bronze/orders_raw/data.parquet',
        parent_tables: null,
        description: 'Raw order transactions from e-commerce platform',
        tags: JSON.stringify(['orders', 'bronze', 'transactions']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 1 * 60 * 60 * 1000, // 1 hour ago
      },
      {
        id: crypto.randomUUID(),
        layer: 'bronze',
        table_name: 'products_raw',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'product_id', type: 'INTEGER', nullable: false },
          { name: 'product_name', type: 'VARCHAR', nullable: false },
          { name: 'category', type: 'VARCHAR', nullable: true },
          { name: 'price', type: 'DECIMAL', nullable: false },
          { name: 'stock_quantity', type: 'INTEGER', nullable: false },
        ]),
        row_count: 5000,
        file_size: 512 * 1024, // 512 KB
        file_path: 's3://flowforge/bronze/products_raw/data.parquet',
        parent_tables: null,
        description: 'Product catalog from inventory system',
        tags: JSON.stringify(['products', 'bronze', 'catalog']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
      },

      // Silver Layer - Production
      {
        id: crypto.randomUUID(),
        layer: 'silver',
        table_name: 'dim_customer',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'customer_sk', type: 'INTEGER', nullable: false },
          { name: 'customer_id', type: 'INTEGER', nullable: false },
          { name: 'full_name', type: 'VARCHAR', nullable: false },
          { name: 'email', type: 'VARCHAR', nullable: false },
          { name: 'created_at', type: 'TIMESTAMP', nullable: false },
          { name: 'updated_at', type: 'TIMESTAMP', nullable: false },
        ]),
        row_count: 123500,
        file_size: 6.2 * 1024 * 1024, // 6.2 MB
        file_path: 's3://flowforge/silver/dim_customer/data.parquet',
        parent_tables: JSON.stringify(['customers_raw']),
        description: 'Cleaned and deduplicated customer dimension',
        tags: JSON.stringify(['customers', 'silver', 'dimension']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 2 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        layer: 'silver',
        table_name: 'dim_product',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'product_sk', type: 'INTEGER', nullable: false },
          { name: 'product_id', type: 'INTEGER', nullable: false },
          { name: 'product_name', type: 'VARCHAR', nullable: false },
          { name: 'category', type: 'VARCHAR', nullable: false },
          { name: 'price', type: 'DECIMAL', nullable: false },
        ]),
        row_count: 4980,
        file_size: 480 * 1024, // 480 KB
        file_path: 's3://flowforge/silver/dim_product/data.parquet',
        parent_tables: JSON.stringify(['products_raw']),
        description: 'Product dimension with validated pricing',
        tags: JSON.stringify(['products', 'silver', 'dimension']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 3 * 60 * 60 * 1000,
      },
      {
        id: crypto.randomUUID(),
        layer: 'silver',
        table_name: 'fact_orders',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'order_sk', type: 'INTEGER', nullable: false },
          { name: 'order_id', type: 'INTEGER', nullable: false },
          { name: 'customer_sk', type: 'INTEGER', nullable: false },
          { name: 'order_date', type: 'DATE', nullable: false },
          { name: 'total_amount', type: 'DECIMAL', nullable: false },
          { name: 'status', type: 'VARCHAR', nullable: false },
        ]),
        row_count: 448200,
        file_size: 14.5 * 1024 * 1024, // 14.5 MB
        file_path: 's3://flowforge/silver/fact_orders/data.parquet',
        parent_tables: JSON.stringify(['orders_raw', 'dim_customer']),
        description: 'Order fact table with foreign keys to dimensions',
        tags: JSON.stringify(['orders', 'silver', 'fact']),
        owner: 'data-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 1 * 60 * 60 * 1000,
      },

      // Gold Layer - Production
      {
        id: crypto.randomUUID(),
        layer: 'gold',
        table_name: 'customer_analytics',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'customer_sk', type: 'INTEGER', nullable: false },
          { name: 'full_name', type: 'VARCHAR', nullable: false },
          { name: 'total_orders', type: 'INTEGER', nullable: false },
          { name: 'total_revenue', type: 'DECIMAL', nullable: false },
          { name: 'avg_order_value', type: 'DECIMAL', nullable: false },
          { name: 'first_order_date', type: 'DATE', nullable: true },
          { name: 'last_order_date', type: 'DATE', nullable: true },
        ]),
        row_count: 98500,
        file_size: 4.8 * 1024 * 1024, // 4.8 MB
        file_path: 's3://flowforge/gold/customer_analytics/data.parquet',
        parent_tables: JSON.stringify(['dim_customer', 'fact_orders']),
        description: 'Customer analytics aggregated from order history',
        tags: JSON.stringify(['analytics', 'gold', 'customers']),
        owner: 'analytics-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 30 * 60 * 1000, // 30 min ago
      },
      {
        id: crypto.randomUUID(),
        layer: 'gold',
        table_name: 'daily_sales_summary',
        environment: 'prod',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'date', type: 'DATE', nullable: false },
          { name: 'total_orders', type: 'INTEGER', nullable: false },
          { name: 'total_revenue', type: 'DECIMAL', nullable: false },
          { name: 'avg_order_value', type: 'DECIMAL', nullable: false },
          { name: 'unique_customers', type: 'INTEGER', nullable: false },
        ]),
        row_count: 365,
        file_size: 64 * 1024, // 64 KB
        file_path: 's3://flowforge/gold/daily_sales_summary/data.parquet',
        parent_tables: JSON.stringify(['fact_orders']),
        description: 'Daily sales KPIs for executive dashboard',
        tags: JSON.stringify(['analytics', 'gold', 'kpi', 'daily']),
        owner: 'analytics-team@company.com',
        created_at: Date.now() - 7 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 15 * 60 * 1000, // 15 min ago
      },

      // Dev Environment Assets (for testing multi-env)
      {
        id: crypto.randomUUID(),
        layer: 'silver',
        table_name: 'dim_customer',
        environment: 'dev',
        job_id: assetJob.id,
        schema: JSON.stringify([
          { name: 'customer_sk', type: 'INTEGER', nullable: false },
          { name: 'customer_id', type: 'INTEGER', nullable: false },
          { name: 'full_name', type: 'VARCHAR', nullable: false },
        ]),
        row_count: 1000,
        file_size: 128 * 1024, // 128 KB
        file_path: 's3://flowforge-dev/silver/dim_customer/data.parquet',
        parent_tables: JSON.stringify(['customers_raw']),
        description: 'Development version of customer dimension',
        tags: JSON.stringify(['customers', 'silver', 'dimension', 'dev']),
        owner: 'dev-team@company.com',
        created_at: Date.now() - 2 * 24 * 60 * 60 * 1000,
        updated_at: Date.now() - 30 * 60 * 1000,
      },
    ];

    // Insert assets
    const insertStmt = db.prepare(`
      INSERT INTO metadata_catalog (
        id, layer, table_name, environment, job_id,
        schema, row_count, file_size, file_path,
        parent_tables, description, tags, owner,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec('BEGIN TRANSACTION');

    for (const asset of assets) {
      insertStmt.run(
        asset.id,
        asset.layer,
        asset.table_name,
        asset.environment,
        asset.job_id,
        asset.schema,
        asset.row_count,
        asset.file_size,
        asset.file_path,
        asset.parent_tables,
        asset.description,
        asset.tags,
        asset.owner,
        asset.created_at,
        asset.updated_at
      );
      console.log(`✓ Created asset: ${asset.layer}/${asset.table_name} (${asset.environment})`);
    }

    db.exec('COMMIT');

    // Create some sample DQ rules
    console.log('\nCreating sample data quality rules...');

    const dqRules = [
      {
        id: crypto.randomUUID(),
        job_id: assetJob.id,
        name: 'Customer Email Not Null',
        rule_type: 'not_null',
        column_name: 'email',
        parameters: null,
        severity: 'error',
        is_active: 1,
        created_at: Date.now(),
      },
      {
        id: crypto.randomUUID(),
        job_id: assetJob.id,
        name: 'Customer ID Unique',
        rule_type: 'unique',
        column_name: 'customer_id',
        parameters: null,
        severity: 'error',
        is_active: 1,
        created_at: Date.now(),
      },
      {
        id: crypto.randomUUID(),
        job_id: assetJob.id,
        name: 'Order Amount Positive',
        rule_type: 'range',
        column_name: 'total_amount',
        parameters: JSON.stringify({ min: 0 }),
        severity: 'error',
        is_active: 1,
        created_at: Date.now(),
      },
    ];

    const dqStmt = db.prepare(`
      INSERT INTO dq_rules (id, job_id, name, rule_type, column_name, parameters, severity, is_active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const rule of dqRules) {
      dqStmt.run(
        rule.id,
        rule.job_id,
        rule.name,
        rule.rule_type,
        rule.column_name,
        rule.parameters,
        rule.severity,
        rule.is_active,
        rule.created_at
      );
      console.log(`✓ Created DQ rule: ${rule.name}`);
    }

    // Summary
    const count = db.prepare('SELECT COUNT(*) as count FROM metadata_catalog').get() as any;
    const byEnv = db.prepare('SELECT environment, COUNT(*) as count FROM metadata_catalog GROUP BY environment').all() as any[];

    console.log('\n✓ Seeding completed successfully!');
    console.log(`\nSummary:`);
    console.log(`  Total assets: ${count.count}`);
    byEnv.forEach((env: any) => {
      console.log(`  ${env.environment}: ${env.count} assets`);
    });

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedDataAssets();
