'use client'

import * as React from 'react'
import { Database, Table, ChevronRight, ChevronDown, FileText, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

// Mock data for demo
const mockCatalog = {
  bronze: [
    { name: 'run_20250104_120000_countries_countries', records: 195, size: '12 KB' },
    { name: 'run_20250104_120100_customers_customer_001', records: 5234, size: '456 KB' },
    { name: 'run_20250104_120100_customers_customer_002', records: 3891, size: '342 KB' },
    { name: 'run_20250104_120200_products_products', records: 1523, size: '234 KB' },
    { name: 'run_20250104_120300_orders_orders', records: 15672, size: '1.2 MB' },
  ],
  silver: [
    { name: 'countries', records: 195, size: '10 KB' },
    { name: 'customers', records: 8891, size: '721 KB' },
    { name: 'products', records: 1523, size: '198 KB' },
    { name: 'orders', records: 15672, size: '1.1 MB' },
  ],
  gold: [
    { name: 'dim_country', records: 195, size: '8 KB' },
    { name: 'dim_customer', records: 8891, size: '654 KB' },
    { name: 'dim_product', records: 1523, size: '187 KB' },
    { name: 'fact_orders', records: 15672, size: '987 KB' },
  ],
}

const mockMetadata = {
  tableName: 'dim_customer',
  layer: 'gold',
  records: 8891,
  size: '654 KB',
  created: '2025-01-04 12:05:23',
  updated: '2025-01-04 12:05:23',
  schema: [
    { name: '_sk_id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
    { name: 'customer_id', type: 'VARCHAR', nullable: false, isBusinessKey: true },
    { name: 'first_name', type: 'VARCHAR', nullable: true },
    { name: 'last_name', type: 'VARCHAR', nullable: true },
    { name: 'email', type: 'VARCHAR', nullable: true },
    { name: 'phone', type: 'VARCHAR', nullable: true },
    { name: 'country_id', type: 'VARCHAR', nullable: true, isForeignKey: true },
    { name: '_source_file', type: 'VARCHAR', nullable: true },
    { name: '_ingested_at', type: 'TIMESTAMP', nullable: true },
  ],
}

const mockData = [
  { _sk_id: 1, customer_id: 'CUST-001', first_name: 'John', last_name: 'Doe', email: 'john.doe@example.com', phone: '+1-555-0101', country_id: 'US', _source_file: 'customer_001.csv', _ingested_at: '2025-01-04 12:01:45' },
  { _sk_id: 2, customer_id: 'CUST-002', first_name: 'Jane', last_name: 'Smith', email: 'jane.smith@example.com', phone: '+1-555-0102', country_id: 'US', _source_file: 'customer_001.csv', _ingested_at: '2025-01-04 12:01:45' },
  { _sk_id: 3, customer_id: 'CUST-003', first_name: 'Bob', last_name: 'Johnson', email: 'bob.j@example.com', phone: '+44-20-7946-0958', country_id: 'GB', _source_file: 'customer_002.csv', _ingested_at: '2025-01-04 12:01:47' },
  { _sk_id: 4, customer_id: 'CUST-004', first_name: 'Alice', last_name: 'Williams', email: 'alice.w@example.com', phone: '+49-30-12345678', country_id: 'DE', _source_file: 'customer_002.csv', _ingested_at: '2025-01-04 12:01:47' },
  { _sk_id: 5, customer_id: 'CUST-005', first_name: 'Charlie', last_name: 'Brown', email: 'charlie.b@example.com', phone: '+1-555-0105', country_id: 'CA', _source_file: 'customer_001.csv', _ingested_at: '2025-01-04 12:01:45' },
]

const mockColumnStats = {
  _sk_id: { uniqueCount: 8891, nullCount: 0, min: 1, max: 8891, dataQuality: 100 },
  customer_id: { uniqueCount: 8891, nullCount: 0, dataQuality: 100 },
  first_name: { uniqueCount: 4521, nullCount: 12, dataQuality: 99.8 },
  last_name: { uniqueCount: 6234, nullCount: 8, dataQuality: 99.9 },
  email: { uniqueCount: 8876, nullCount: 45, dataQuality: 99.5 },
  phone: { uniqueCount: 8654, nullCount: 234, dataQuality: 97.4 },
  country_id: { uniqueCount: 87, nullCount: 0, dataQuality: 100 },
}

type Layer = 'bronze' | 'silver' | 'gold'

export default function DataCatalogPage() {
  const [expandedLayers, setExpandedLayers] = React.useState<Set<Layer>>(new Set(['gold']))
  const [selectedTable, setSelectedTable] = React.useState<string>('dim_customer')
  const [selectedLayer, setSelectedLayer] = React.useState<Layer>('gold')
  const [sqlQuery, setSqlQuery] = React.useState('SELECT * FROM dim_customer LIMIT 100;')

  const toggleLayer = (layer: Layer) => {
    const newExpanded = new Set(expandedLayers)
    if (newExpanded.has(layer)) {
      newExpanded.delete(layer)
    } else {
      newExpanded.add(layer)
    }
    setExpandedLayers(newExpanded)
  }

  const selectTable = (layer: Layer, tableName: string) => {
    setSelectedLayer(layer)
    setSelectedTable(tableName)
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      {/* Left Panel - Explorer Tree */}
      <div className="w-80 border-r border-border bg-background-secondary p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Explorer
        </h2>

        {/* Bronze Layer */}
        <div className="mb-3">
          <button
            onClick={() => toggleLayer('bronze')}
            className="flex items-center gap-2 w-full text-left py-2 px-2 rounded hover:bg-background-tertiary transition-colors"
          >
            {expandedLayers.has('bronze') ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Database className="w-4 h-4 text-amber-600" />
            <span className="font-medium">Bronze Layer</span>
            <span className="ml-auto text-xs text-muted-foreground">{mockCatalog.bronze.length}</span>
          </button>
          {expandedLayers.has('bronze') && (
            <div className="ml-6 mt-1 space-y-1">
              {mockCatalog.bronze.map((table) => (
                <button
                  key={table.name}
                  onClick={() => selectTable('bronze', table.name)}
                  className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded text-sm hover:bg-background-tertiary transition-colors ${
                    selectedLayer === 'bronze' && selectedTable === table.name ? 'bg-background-tertiary' : ''
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{table.name}</span>
                  <span className="text-xs text-muted-foreground">{table.records.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Silver Layer */}
        <div className="mb-3">
          <button
            onClick={() => toggleLayer('silver')}
            className="flex items-center gap-2 w-full text-left py-2 px-2 rounded hover:bg-background-tertiary transition-colors"
          >
            {expandedLayers.has('silver') ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Database className="w-4 h-4 text-slate-400" />
            <span className="font-medium">Silver Layer</span>
            <span className="ml-auto text-xs text-muted-foreground">{mockCatalog.silver.length}</span>
          </button>
          {expandedLayers.has('silver') && (
            <div className="ml-6 mt-1 space-y-1">
              {mockCatalog.silver.map((table) => (
                <button
                  key={table.name}
                  onClick={() => selectTable('silver', table.name)}
                  className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded text-sm hover:bg-background-tertiary transition-colors ${
                    selectedLayer === 'silver' && selectedTable === table.name ? 'bg-background-tertiary' : ''
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{table.name}</span>
                  <span className="text-xs text-muted-foreground">{table.records.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Gold Layer */}
        <div className="mb-3">
          <button
            onClick={() => toggleLayer('gold')}
            className="flex items-center gap-2 w-full text-left py-2 px-2 rounded hover:bg-background-tertiary transition-colors"
          >
            {expandedLayers.has('gold') ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            <Database className="w-4 h-4 text-yellow-500" />
            <span className="font-medium">Gold Layer</span>
            <span className="ml-auto text-xs text-muted-foreground">{mockCatalog.gold.length}</span>
          </button>
          {expandedLayers.has('gold') && (
            <div className="ml-6 mt-1 space-y-1">
              {mockCatalog.gold.map((table) => (
                <button
                  key={table.name}
                  onClick={() => selectTable('gold', table.name)}
                  className={`flex items-center gap-2 w-full text-left py-1.5 px-2 rounded text-sm hover:bg-background-tertiary transition-colors ${
                    selectedLayer === 'gold' && selectedTable === table.name ? 'bg-background-tertiary' : ''
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span className="flex-1 truncate">{table.name}</span>
                  <span className="text-xs text-muted-foreground">{table.records.toLocaleString()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Center Panel - Metadata & Data Grid */}
      <div className="flex-1 flex flex-col">
        <div className="border-b border-border p-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Table className="w-6 h-6" />
            {selectedTable}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {selectedLayer.charAt(0).toUpperCase() + selectedLayer.slice(1)} Layer • {mockMetadata.records.toLocaleString()} records • {mockMetadata.size}
          </p>
        </div>

        <Tabs defaultValue="metadata" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="metadata">Metadata</TabsTrigger>
            <TabsTrigger value="data">Data Preview</TabsTrigger>
            <TabsTrigger value="query">SQL Query</TabsTrigger>
          </TabsList>

          <TabsContent value="metadata" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-background-secondary rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{mockMetadata.created}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">{mockMetadata.updated}</p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-3">Schema</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-background-secondary">
                      <tr>
                        <th className="text-left py-2 px-4 text-sm font-medium">Column Name</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Data Type</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Nullable</th>
                        <th className="text-left py-2 px-4 text-sm font-medium">Constraints</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockMetadata.schema.map((col, idx) => (
                        <tr key={col.name} className={idx % 2 === 0 ? 'bg-background' : 'bg-background-secondary'}>
                          <td className="py-2 px-4 font-mono text-sm">{col.name}</td>
                          <td className="py-2 px-4 text-sm">{col.type}</td>
                          <td className="py-2 px-4 text-sm">{col.nullable ? 'Yes' : 'No'}</td>
                          <td className="py-2 px-4 text-sm">
                            {col.isPrimaryKey && (
                              <span className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-600 rounded text-xs mr-1">PK</span>
                            )}
                            {col.isBusinessKey && (
                              <span className="inline-block px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs mr-1">BK</span>
                            )}
                            {col.isForeignKey && (
                              <span className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-600 rounded text-xs">FK</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="flex-1 overflow-auto p-4">
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-background-secondary sticky top-0">
                  <tr>
                    {mockMetadata.schema.map((col) => (
                      <th key={col.name} className="text-left py-2 px-3 font-medium whitespace-nowrap">
                        {col.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mockData.map((row, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-background' : 'bg-background-secondary'}>
                      <td className="py-2 px-3">{row._sk_id}</td>
                      <td className="py-2 px-3">{row.customer_id}</td>
                      <td className="py-2 px-3">{row.first_name}</td>
                      <td className="py-2 px-3">{row.last_name}</td>
                      <td className="py-2 px-3">{row.email}</td>
                      <td className="py-2 px-3">{row.phone}</td>
                      <td className="py-2 px-3">{row.country_id}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{row._source_file}</td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{row._ingested_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-sm text-muted-foreground mt-3">Showing 5 of {mockMetadata.records.toLocaleString()} records</p>
          </TabsContent>

          <TabsContent value="query" className="flex-1 flex flex-col p-4">
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex-1 border border-border rounded-lg overflow-hidden">
                <textarea
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  className="w-full h-full p-4 bg-background font-mono text-sm resize-none focus:outline-none"
                  placeholder="Enter SQL query..."
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">SQL query editor (read-only for demo)</p>
                <Button disabled className="flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Execute Query
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Right Panel - Column Statistics */}
      <div className="w-80 border-l border-border bg-background-secondary p-4 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Column Statistics
        </h2>

        <div className="space-y-3">
          {Object.entries(mockColumnStats).map(([colName, stats]) => (
            <div key={colName} className="p-3 bg-background rounded-lg">
              <h3 className="font-medium text-sm mb-2 font-mono">{colName}</h3>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unique Values:</span>
                  <span className="font-medium">{stats.uniqueCount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Null Count:</span>
                  <span className="font-medium">{stats.nullCount.toLocaleString()}</span>
                </div>
                {stats.min !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Min:</span>
                      <span className="font-medium">{stats.min}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Max:</span>
                      <span className="font-medium">{stats.max}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between items-center pt-1">
                  <span className="text-muted-foreground">Data Quality:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-background-tertiary rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          stats.dataQuality >= 95 ? 'bg-green-500' : stats.dataQuality >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${stats.dataQuality}%` }}
                      />
                    </div>
                    <span className="font-medium">{stats.dataQuality}%</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
