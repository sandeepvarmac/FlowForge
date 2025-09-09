import { DashboardMetrics, RecentActivity } from '@/types'
import { Workflow, Job } from '@/types/workflow'

// Mock data for dashboard metrics
export const mockDashboardMetrics: DashboardMetrics = {
  runsToday: 24,
  failures: 2,
  dqViolations: 5,
  totalWorkflows: 47,
  activeWorkflows: 31,
  lastUpdated: new Date()
}

// Mock data for recent activities
export const mockRecentActivities: RecentActivity[] = [
  {
    id: '1',
    type: 'workflow_completed',
    workflowName: 'Data Pipeline ETL',
    timestamp: new Date(Date.now() - 2 * 60 * 1000), // 2 minutes ago
    status: 'success',
    message: 'Successfully processed 15,234 records'
  },
  {
    id: '2',
    type: 'workflow_started',
    workflowName: 'Customer Data Sync',
    timestamp: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
    status: 'running'
  },
  {
    id: '3',
    type: 'workflow_failed',
    workflowName: 'Inventory Update',
    timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
    status: 'failed',
    message: 'Connection timeout to external API'
  },
  {
    id: '4',
    type: 'workflow_completed',
    workflowName: 'Daily Report Generation',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: 'success'
  },
  {
    id: '5',
    type: 'workflow_started',
    workflowName: 'Security Audit Scan',
    timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
    status: 'running'
  }
]

// Mock data for workflow execution trends (last 7 days)
export const mockWorkflowTrends = [
  { name: 'Mon', executions: 45, failures: 2, success: 43 },
  { name: 'Tue', executions: 52, failures: 1, success: 51 },
  { name: 'Wed', executions: 38, failures: 4, success: 34 },
  { name: 'Thu', executions: 61, failures: 3, success: 58 },
  { name: 'Fri', executions: 47, failures: 2, success: 45 },
  { name: 'Sat', executions: 32, failures: 1, success: 31 },
  { name: 'Sun', executions: 24, failures: 2, success: 22 }
]

// Mock data for workflow performance over time (last 24 hours)
export const mockPerformanceData = [
  { name: '00:00', responseTime: 245, throughput: 87 },
  { name: '02:00', responseTime: 198, throughput: 92 },
  { name: '04:00', responseTime: 167, throughput: 95 },
  { name: '06:00', responseTime: 234, throughput: 89 },
  { name: '08:00', responseTime: 445, throughput: 76 },
  { name: '10:00', responseTime: 387, throughput: 82 },
  { name: '12:00', responseTime: 298, throughput: 88 },
  { name: '14:00', responseTime: 356, throughput: 85 },
  { name: '16:00', responseTime: 267, throughput: 91 },
  { name: '18:00', responseTime: 198, throughput: 94 },
  { name: '20:00', responseTime: 234, throughput: 90 },
  { name: '22:00', responseTime: 187, throughput: 96 }
]

// Mock data for workflow status distribution
export const mockStatusDistribution = [
  { name: 'Completed', value: 68, color: '#059669' },
  { name: 'Running', value: 15, color: '#2563eb' },
  { name: 'Failed', value: 8, color: '#dc2626' },
  { name: 'Scheduled', value: 9, color: '#d97706' }
]

// Mock data for system resources
export const mockSystemResources = [
  { name: 'CPU Usage', value: 67, max: 100, color: '#2563eb' },
  { name: 'Memory', value: 84, max: 100, color: '#059669' },
  { name: 'Storage', value: 45, max: 100, color: '#d97706' },
  { name: 'Network', value: 23, max: 100, color: '#7c3aed' }
]

// Generate mini trend data for metric cards
export function generateMiniTrend(length: number = 12): number[] {
  return Array.from({ length }, () => Math.floor(Math.random() * 100) + 1)
}

// Mock Workflows with Jobs (EDP Architecture)
export const mockWorkflows: Workflow[] = [
  {
    id: '1',
    name: 'ILPA Fund Performance ETL',
    description: 'Daily ingestion of fund performance data from multiple sources',
    application: 'ILPA',
    owner: 'Fund Accounting Team',
    status: 'completed',
    type: 'scheduled',
    jobs: [
      {
        id: 'job-1-1',
        workflowId: '1',
        name: 'NAV Data Import',
        description: 'Import daily NAV data from CSV files',
        type: 'file-based',
        order: 1,
        sourceConfig: {
          id: 'src-1',
          name: 'NAV CSV Files',
          type: 'csv',
          connection: {},
          fileConfig: {
            filePath: '/data/nav/daily',
            filePattern: 'nav_*.csv',
            encoding: 'utf-8',
            delimiter: ',',
            hasHeader: true,
            skipRows: 0,
            compressionType: 'none'
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_nav_raw',
            storageFormat: 'parquet'
          },
          silverConfig: {
            enabled: true,
            tableName: 'silver_nav_cleaned',
            storageFormat: 'parquet',
            partitionKeys: ['date']
          },
          goldConfig: {
            enabled: true,
            tableName: 'gold_nav_reporting',
            storageFormat: 'iceberg'
          }
        },
        transformationConfig: {
          columnMappings: [
            { sourceColumn: 'fund_id', targetColumn: 'fund_identifier', dataType: 'string' },
            { sourceColumn: 'nav_value', targetColumn: 'net_asset_value', dataType: 'decimal' },
            { sourceColumn: 'date', targetColumn: 'valuation_date', dataType: 'date' }
          ],
          useDirectSql: false
        },
        status: 'completed',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      },
      {
        id: 'job-1-2',
        workflowId: '1',
        name: 'Performance Metrics',
        description: 'Calculate daily performance metrics',
        type: 'database',
        order: 2,
        sourceConfig: {
          id: 'src-2',
          name: 'Performance DB',
          type: 'sql-server',
          connection: {
            host: 'perf-db.internal',
            database: 'FundPerformance',
            username: 'etl_user'
          },
          databaseConfig: {
            query: 'SELECT * FROM daily_performance WHERE last_updated > ?',
            deltaColumn: 'last_updated',
            isIncremental: true
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_performance_raw',
            storageFormat: 'parquet'
          },
          silverConfig: {
            enabled: true,
            tableName: 'silver_performance_metrics',
            storageFormat: 'parquet'
          }
        },
        status: 'completed',
        lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
      }
    ],
    lastRun: new Date(Date.now() - 2 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 22 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000)
  },
  {
    id: '2',
    name: 'Mailchimp Campaign Analysis',
    description: 'Extract and reconcile campaign data from Mailchimp API',
    application: 'Marketing Analytics',
    owner: 'Marketing Team',
    status: 'running',
    type: 'scheduled',
    jobs: [
      {
        id: 'job-2-1',
        workflowId: '2',
        name: 'Campaign Data Extract',
        description: 'Extract campaign data via Mailchimp API',
        type: 'api',
        order: 1,
        sourceConfig: {
          id: 'src-3',
          name: 'Mailchimp API',
          type: 'api',
          connection: {},
          apiConfig: {
            endpoint: 'https://us1.api.mailchimp.com/3.0/campaigns',
            method: 'GET',
            authType: 'api-key',
            authConfig: { 'X-API-Key': 'stored-in-secrets' }
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_mailchimp_campaigns',
            storageFormat: 'parquet'
          },
          silverConfig: {
            enabled: true,
            tableName: 'silver_campaign_metrics',
            storageFormat: 'parquet'
          }
        },
        validationConfig: {
          reconciliationRules: [
            {
              name: 'Campaign Count Validation',
              sourceJob: 'job-2-1',
              targetJob: 'job-2-2',
              reconciliationColumn: 'campaign_id'
            }
          ]
        },
        status: 'running',
        lastRun: new Date(Date.now() - 15 * 60 * 1000),
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 15 * 60 * 1000)
      },
      {
        id: 'job-2-2',
        workflowId: '2',
        name: 'Click Reports',
        description: 'Process campaign click reports',
        type: 'file-based',
        order: 2,
        sourceConfig: {
          id: 'src-4',
          name: 'Click Report Files',
          type: 'csv',
          connection: {},
          fileConfig: {
            filePath: '/data/mailchimp/clicks',
            filePattern: 'clicks_*.csv',
            encoding: 'utf-8',
            delimiter: ',',
            hasHeader: true,
            skipRows: 1
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_click_reports',
            storageFormat: 'parquet'
          }
        },
        status: 'ready',
        createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
      }
    ],
    lastRun: new Date(Date.now() - 15 * 60 * 1000),
    nextRun: new Date(Date.now() + 45 * 60 * 1000),
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 15 * 60 * 1000)
  },
  {
    id: '3',
    name: 'Investran Delta Load',
    description: 'Incremental data sync from Investran system using change tracking',
    application: 'Investran',
    owner: 'Data Engineering',
    status: 'failed',
    type: 'scheduled',
    jobs: [
      {
        id: 'job-3-1',
        workflowId: '3',
        name: 'Portfolio Data Sync',
        description: 'Sync portfolio changes using SQL Server change tracking',
        type: 'database',
        order: 1,
        sourceConfig: {
          id: 'src-5',
          name: 'Investran DB',
          type: 'sql-server',
          connection: {
            host: 'investran-db.internal',
            database: 'InvestranProd',
            username: 'sync_user'
          },
          databaseConfig: {
            storedProcedure: 'sp_get_portfolio_changes',
            isIncremental: true
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_investran_portfolio',
            storageFormat: 'parquet'
          },
          silverConfig: {
            enabled: true,
            tableName: 'silver_portfolio_data',
            storageFormat: 'parquet',
            partitionKeys: ['portfolio_id', 'date']
          }
        },
        status: 'failed',
        lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
      }
    ],
    lastRun: new Date(Date.now() - 4 * 60 * 60 * 1000),
    nextRun: new Date(Date.now() + 20 * 60 * 60 * 1000),
    createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000)
  },
  {
    id: '4',
    name: 'Daily Trade Settlement',
    description: 'Process daily trade files with validation and reconciliation',
    application: 'Trade Processing',
    owner: 'Operations Team',
    status: 'manual',
    type: 'manual',
    jobs: [
      {
        id: 'job-4-1',
        workflowId: '4',
        name: 'Trade File Processing',
        description: 'Process encrypted trade files from SFTP',
        type: 'file-based',
        order: 1,
        sourceConfig: {
          id: 'src-6',
          name: 'Trade SFTP',
          type: 'sftp',
          connection: {
            host: 'trades.external.com',
            username: 'carlyle_user'
          },
          fileConfig: {
            filePath: '/outbound/trades',
            filePattern: 'trades_\\d{8}\\.zip',
            encoding: 'utf-8',
            delimiter: '|',
            hasHeader: true,
            compressionType: 'zip'
          }
        },
        destinationConfig: {
          bronzeConfig: {
            enabled: true,
            tableName: 'bronze_trade_files',
            storageFormat: 'parquet'
          },
          silverConfig: {
            enabled: true,
            tableName: 'silver_trades_validated',
            storageFormat: 'parquet',
            partitionKeys: ['trade_date', 'portfolio']
          },
          goldConfig: {
            enabled: true,
            tableName: 'gold_daily_settlements',
            storageFormat: 'iceberg'
          }
        },
        transformationConfig: {
          columnMappings: [
            { sourceColumn: 'TRADE_ID', targetColumn: 'trade_identifier', dataType: 'string' },
            { sourceColumn: 'TRADE_DATE', targetColumn: 'settlement_date', dataType: 'date' },
            { sourceColumn: 'AMOUNT', targetColumn: 'settlement_amount', dataType: 'decimal' }
          ],
          lookups: [
            {
              name: 'Portfolio Lookup',
              sourceTable: 'silver_portfolio_master',
              joinKeys: [
                { sourceColumn: 'PORTFOLIO_CD', targetColumn: 'portfolio_code' }
              ],
              selectColumns: ['portfolio_name', 'currency']
            }
          ],
          useDirectSql: false
        },
        validationConfig: {
          dataQualityRules: [
            {
              name: 'Trade ID Not Null',
              column: 'trade_identifier',
              ruleType: 'not_null',
              severity: 'error'
            },
            {
              name: 'Valid Settlement Amount',
              column: 'settlement_amount',
              ruleType: 'range',
              parameters: { min: 0 },
              severity: 'warning'
            }
          ],
          notificationEmail: 'operations@carlyle.com'
        },
        status: 'configured',
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      }
    ],
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
  }
]