'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Database, Search } from 'lucide-react';
import { DataAssetsLayout } from '@/components/data-assets';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Layer = 'bronze' | 'silver' | 'gold';
type Environment = 'dev' | 'qa' | 'uat' | 'prod' | 'development' | 'production';

export default function DataAssetsExplorerPage() {
  const router = useRouter();

  const [selectedEnvironment, setSelectedEnvironment] = React.useState<Environment>('prod');
  const [selectedLayer, setSelectedLayer] = React.useState<Layer | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  const [workflowGroups, setWorkflowGroups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 30;

  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [assetDetails, setAssetDetails] = React.useState<any | null>(null);
  const [schemaDetails, setSchemaDetails] = React.useState<any | null>(null);
  const [sampleData, setSampleData] = React.useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = React.useState(false);
  const [detailTab, setDetailTab] = React.useState<'schema' | 'ddl' | 'preview' | 'dependencies' | 'insights'>('schema');

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('environments', selectedEnvironment);
      if (searchQuery) params.set('search', searchQuery);
      const response = await fetch(`/api/data-assets/list?${params}`);
      const data = await response.json();
      setWorkflowGroups(data.workflowGroups || []);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, searchQuery]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const allDatasets = React.useMemo(() => {
    const datasets: any[] = [];
    workflowGroups.forEach((wf) => {
      (wf.sources || wf.jobs || []).forEach((src: any) => {
        (src.datasets || []).forEach((ds: any) => {
          const tableName = ds.table_name || ds.tableName || ds.name || ds.datasetName;
          datasets.push({
            ...ds,
            id: ds.id || ds.asset_id || `${wf.pipelineId || wf.workflowId}-${src.sourceId || src.jobId}-${ds.layer}`,
            workflowId: wf.pipelineId || wf.workflowId,
            workflowName: wf.pipelineName || wf.workflowName,
            sourceId: src.sourceId || src.jobId,
            sourceName: src.sourceName || src.jobName,
            layer: ds.layer || ds.datasetType || 'bronze',
            tableName,
            rowCount: ds.rowCount ?? ds.row_count,
            lastUpdated: ds.lastUpdated || ds.updated_at,
          });
        });
      });
    });
    return datasets;
  }, [workflowGroups]);

  const filteredDatasets = React.useMemo(() => {
    return allDatasets
      .filter((ds) => selectedLayer === 'all' || ds.layer === selectedLayer)
      .filter((ds) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          (ds.tableName || '').toLowerCase().includes(q) ||
          (ds.sourceName || '').toLowerCase().includes(q) ||
          (ds.workflowName || '').toLowerCase().includes(q)
        );
      });
  }, [allDatasets, selectedLayer, searchQuery]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedLayer, searchQuery]);

  const paginatedAssets = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return filteredDatasets.slice(start, end);
  }, [filteredDatasets, currentPage]);

  const totalPages = Math.ceil(filteredDatasets.length / ITEMS_PER_PAGE) || 1;

  const loadAssetDetails = React.useCallback(
    async (assetId: string) => {
      setLoadingDetails(true);
      try {
        const [assetRes, schemaRes, sampleRes] = await Promise.all([
          fetch(`/api/data-assets/${assetId}`),
          fetch(`/api/data-assets/${assetId}/schema`),
          fetch(`/api/data-assets/${assetId}/sample?limit=25`),
        ]);

        const assetJson = await assetRes.json();
        const schemaJson = await schemaRes.json();
        const sampleJson = await sampleRes.json();

        setAssetDetails(assetJson.asset || assetJson);
        setSchemaDetails(schemaJson);
        setSampleData(sampleJson);
      } catch (err) {
        console.error('Failed to load asset details', err);
        setAssetDetails(null);
        setSchemaDetails(null);
        setSampleData(null);
      } finally {
        setLoadingDetails(false);
      }
    },
    []
  );

  React.useEffect(() => {
    const first = paginatedAssets[0];
    if (!selectedAssetId && first?.id) {
      setSelectedAssetId(first.id);
      loadAssetDetails(first.id);
    }
  }, [paginatedAssets, selectedAssetId, loadAssetDetails]);

  const renderFilters = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Environment:</label>
          <select
            value={selectedEnvironment}
            onChange={(e) => setSelectedEnvironment(e.target.value as Environment)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="prod">Production</option>
            <option value="uat">UAT</option>
            <option value="qa">QA</option>
            <option value="dev">Development</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Layer:</label>
          <select
            value={selectedLayer}
            onChange={(e) => setSelectedLayer(e.target.value as Layer | 'all')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Layers</option>
            <option value="bronze">Bronze</option>
            <option value="silver">Silver</option>
            <option value="gold">Gold</option>
          </select>
        </div>

        <div className="flex-1 min-w-[240px]">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search datasets, sources, or pipelines"
              className="pl-9"
            />
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-500">
        Showing {filteredDatasets.length} dataset{filteredDatasets.length === 1 ? '' : 's'} in {selectedEnvironment}
      </div>
    </div>
  );

  return (
    <DataAssetsLayout>
      <div className="flex flex-col h-full">
        {renderFilters()}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-4">
            {loading ? (
              <div className="text-center text-gray-500">Loading datasets...</div>
            ) : filteredDatasets.length === 0 ? (
              <div className="text-center text-gray-500">No datasets found</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4">
                  {paginatedAssets.map((asset: any) => (
                    <div
                      key={asset.id || `${asset.tableName}-${asset.layer}-${asset.workflowId}-${asset.sourceId}`}
                      className={`bg-white border rounded-lg shadow-sm p-4 transition-colors cursor-pointer ${
                        selectedAssetId === asset.id
                          ? 'border-primary-300 ring-2 ring-primary-100'
                          : 'border-gray-200 hover:border-primary-200'
                      }`}
                      onClick={() => {
                        setSelectedAssetId(asset.id);
                        loadAssetDetails(asset.id);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          <Database className="w-4 h-4 text-gray-500" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-gray-900 truncate">
                              {asset.tableName || asset.table_name || asset.datasetName || asset.name || 'Dataset'}
                            </h3>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                asset.layer === 'bronze'
                                  ? 'bg-amber-100 text-amber-700'
                                  : asset.layer === 'silver'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {asset.layer?.toUpperCase()}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600">
                            {asset.workflowName && <span className="mr-2">Pipeline: {asset.workflowName}</span>}
                            {asset.sourceName && <span className="mr-2">Source: {asset.sourceName}</span>}
                          </div>
                          <div className="text-xs text-gray-500">
                            {asset.rowCount ? `${asset.rowCount.toLocaleString()} rows` : 'Row count unavailable'} -{' '}
                            {asset.lastUpdated
                              ? formatDistanceToNow(new Date(asset.lastUpdated), { addSuffix: true })
                              : 'Updated just now'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-2 text-sm text-gray-600">
                    <div>
                      Page {currentPage} of {totalPages}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="lg:col-span-2">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm h-full p-4">
              {loadingDetails ? (
                <div className="text-gray-500">Loading details...</div>
              ) : !assetDetails ? (
                <div className="text-gray-500">Select a dataset to view details.</div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-900">
                          {assetDetails.table_name || assetDetails.tableName || assetDetails.name}
                        </h2>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {assetDetails.layer?.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {assetDetails.pipeline_name && <span className="mr-2">Pipeline: {assetDetails.pipeline_name}</span>}
                        {assetDetails.source_name && <span className="mr-2">Source: {assetDetails.source_name}</span>}
                        {assetDetails.row_count && <span className="mr-2">{assetDetails.row_count.toLocaleString()} rows</span>}
                      </div>
                    </div>
                  </div>

                  <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as any)} className="flex flex-col min-h-0">
                    <div className="border-b px-2">
                      <TabsList className="bg-transparent h-auto p-0 flex flex-wrap gap-2">
                        <TabsTrigger value="schema" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                          Schema ({(schemaDetails?.schema || schemaDetails?.columns || []).length || 0} columns)
                        </TabsTrigger>
                        <TabsTrigger value="ddl" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                          DDL
                        </TabsTrigger>
                        <TabsTrigger value="preview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                          Preview (first {Math.min(100, sampleData?.rows?.length || 0)} rows)
                        </TabsTrigger>
                        <TabsTrigger value="dependencies" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                          Dependencies
                        </TabsTrigger>
                        <TabsTrigger value="insights" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
                          AI Insights
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    <TabsContent value="schema" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                      <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                        <div className="overflow-auto flex-1 min-h-0">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20 bg-primary text-white shadow-md border-b border-primary-700">
                              <tr>
                                <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Column Name</th>
                                <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Data Type</th>
                                <th className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent">Nullable</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(schemaDetails?.schema || schemaDetails?.columns || []).map((col: any, idx: number) => (
                                <tr key={idx} className="border-b border-primary-100 hover:bg-primary-50 odd:bg-primary-50/50 even:bg-white">
                                  <td className="p-3 font-mono text-foreground">{col.name}</td>
                                  <td className="p-3 text-muted-foreground whitespace-nowrap">{col.type || col.raw_type}</td>
                                  <td className="p-3 text-muted-foreground text-xs">{col.nullable ? 'Yes' : 'No'}</td>
                                </tr>
                              ))}
                              {(schemaDetails?.schema || schemaDetails?.columns || []).length === 0 && (
                                <tr>
                                  <td className="p-3 text-gray-500" colSpan={3}>
                                    No schema available
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="ddl" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                      <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                        <div className="overflow-auto flex-1 min-h-0 p-4 bg-muted/30">
                          <pre className="text-sm font-mono text-foreground whitespace-pre-wrap">
                            {`CREATE TABLE ${assetDetails.table_name || assetDetails.tableName || 'dataset'} (\n${(schemaDetails?.schema || schemaDetails?.columns || []).map((col: any, idx: number) => {
                              return `  ${col.name} ${col.type || col.raw_type || 'string'}${col.nullable === false ? ' NOT NULL' : ''}${idx < (schemaDetails?.schema || schemaDetails?.columns || []).length - 1 ? ',' : ''}`
                            }).join('\n')}\n);`}
                          </pre>
                        </div>
                        <div className="px-4 py-2 border-t bg-card flex-shrink-0 text-xs text-muted-foreground">
                          Generated from catalog metadata; actual DDL may differ in source system.
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="preview" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                      <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                        <div className="px-4 py-2 border-b bg-muted/30 text-foreground flex-shrink-0">
                          <p className="text-sm text-muted-foreground">
                            Showing {Math.min(100, sampleData?.rows?.length || 0)} of {(sampleData?.total_rows_in_sample || sampleData?.rows?.length || 0).toLocaleString()} sample rows
                          </p>
                        </div>
                        <div className="overflow-auto flex-1 min-h-0">
                          <table className="w-full text-sm">
                            <thead className="sticky top-0 z-20 bg-primary text-white shadow-md border-b border-primary-700">
                              <tr>
                                {(schemaDetails?.schema || schemaDetails?.columns || sampleData?.columns || []).map((col: any) => (
                                  <th key={col.name} className="text-left p-3 font-semibold border-b border-primary-800 bg-transparent whitespace-nowrap">
                                    {col.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(sampleData?.rows || []).map((row: any, idx: number) => (
                                <tr key={idx} className="border-b border-primary-100 hover:bg-primary-50 odd:bg-primary-50/50 even:bg-white">
                                  {(schemaDetails?.schema || schemaDetails?.columns || sampleData?.columns || Object.keys(row || {}).map((name) => ({ name }))).map((col: any) => (
                                    <td key={col.name} className="p-3 text-foreground whitespace-nowrap">
                                      {row && row[col.name] !== null && row[col.name] !== undefined ? String(row[col.name]) : ''}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              {(sampleData?.rows || []).length === 0 && (
                                <tr>
                                  <td className="p-3 text-gray-500">No sample available</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="dependencies" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                      <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden">
                        <div className="p-4 text-sm text-foreground">
                          {assetDetails.parent_tables && assetDetails.parent_tables.length > 0 ? (
                            <ul className="list-disc list-inside space-y-1">
                              {assetDetails.parent_tables.map((p: string) => (
                                <li key={p}>{p}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-muted-foreground">No dependencies recorded for this dataset.</p>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="insights" className="flex-1 min-h-0 m-0 p-4 overflow-hidden data-[state=inactive]:hidden">
                      <div className="border rounded-md h-full flex flex-col min-h-0 overflow-hidden p-4 text-sm text-muted-foreground">
                        AI insights for processed data are coming soon. You can still view schema and preview above.
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DataAssetsLayout>
  );
}
