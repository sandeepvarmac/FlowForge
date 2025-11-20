'use client';

/**
 * Data Assets Explorer Page
 * Three-panel layout: Filters | Asset List | Asset Details
 */

import React from 'react';
import { Search, Filter, X, Database, Table, FileText, Download, Edit, Copy, ExternalLink, Upload, Workflow, Sparkles } from 'lucide-react';
import { LayerBadge } from '@/components/data-assets/LayerBadge';
import { EnvironmentBadge } from '@/components/data-assets/EnvironmentBadge';
import { QualityIndicator } from '@/components/data-assets/QualityIndicator';
import { AssetCard } from '@/components/data-assets/AssetCard';
import { SourceDatabasesView } from '@/components/data-assets/SourceDatabasesView';
import { GlobalSearchBar } from '@/components/data-assets/global-search-bar';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

type Layer = 'bronze' | 'silver' | 'gold';
type Environment = 'dev' | 'qa' | 'uat' | 'prod';
type QualityStatus = 'healthy' | 'issues' | 'no-rules';
type DetailTab = 'overview' | 'schema' | 'sample' | 'quality' | 'lineage' | 'jobs';
type ViewMode = 'processed' | 'sources';

export default function DataAssetsExplorerPage() {
  const router = useRouter();

  // View mode state
  const [viewMode, setViewMode] = React.useState<ViewMode>('processed');

  // Filters state
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<Environment>('prod');
  const [selectedLayers, setSelectedLayers] = React.useState<Layer[]>([]);
  const [selectedWorkflows, setSelectedWorkflows] = React.useState<string[]>([]);
  const [selectedQualityStatus, setSelectedQualityStatus] = React.useState<QualityStatus[]>([]);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showFilters, setShowFilters] = React.useState(true);

  // Source databases state
  const [sourceConnections, setSourceConnections] = React.useState<any[]>([]);
  const [selectedConnection, setSelectedConnection] = React.useState<any>(null);
  const [sourceTables, setSourceTables] = React.useState<string[]>([]);
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null);
  const [tablePreview, setTablePreview] = React.useState<any>(null);
  const [loadingTables, setLoadingTables] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);

  // Data state
  const [assets, setAssets] = React.useState<any[]>([]);
  const [workflows, setWorkflows] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [selectedAsset, setSelectedAsset] = React.useState<any>(null);
  const [assetDetails, setAssetDetails] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // Detail tab state
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');

  // Load assets
  const loadAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();

      params.set('environments', selectedEnvironment);
      if (selectedLayers.length > 0) params.set('layers', selectedLayers.join(','));
      if (selectedWorkflows.length > 0) params.set('workflowIds', selectedWorkflows.join(','));
      if (selectedQualityStatus.length > 0) params.set('qualityStatus', selectedQualityStatus.join(','));
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`/api/data-assets/list?${params}`);
      const data = await response.json();

      setAssets(data.assets || []);
      setWorkflows(data.workflows || []);
      setStats(data.stats || null);

      // Auto-select first asset if none selected
      if (data.assets?.length > 0 && !selectedAsset) {
        setSelectedAsset(data.assets[0]);
      }
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, selectedLayers, selectedWorkflows, selectedQualityStatus, searchQuery, selectedAsset]);

  // Load asset details
  const loadAssetDetails = React.useCallback(async (assetId: string) => {
    try {
      const response = await fetch(`/api/data-assets/${assetId}`);
      const data = await response.json();
      setAssetDetails(data);
    } catch (error) {
      console.error('Failed to load asset details:', error);
    }
  }, []);

  React.useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  React.useEffect(() => {
    if (selectedAsset) {
      loadAssetDetails(selectedAsset.id);
    }
  }, [selectedAsset, loadAssetDetails]);

  // Filter toggle handlers
  const toggleLayer = (layer: Layer) => {
    setSelectedLayers(prev =>
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  const toggleWorkflow = (workflowId: string) => {
    setSelectedWorkflows(prev =>
      prev.includes(workflowId) ? prev.filter(w => w !== workflowId) : [...prev, workflowId]
    );
  };

  const toggleQualityStatus = (status: QualityStatus) => {
    setSelectedQualityStatus(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const clearAllFilters = () => {
    setSelectedLayers([]);
    setSelectedWorkflows([]);
    setSelectedQualityStatus([]);
    setSearchQuery('');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Assets Explorer</h1>
            <p className="text-sm text-gray-600 mt-1">
              Browse processed assets and source databases
            </p>
          </div>

          {/* Environment Selector (only for processed view) */}
          {viewMode === 'processed' && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Environment:</label>
                <select
                  value={selectedEnvironment}
                  onChange={(e) => setSelectedEnvironment(e.target.value as Environment)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="prod">Production</option>
                  <option value="uat">UAT</option>
                  <option value="qa">QA</option>
                  <option value="dev">Development</option>
                </select>
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm">{showFilters ? 'Hide' : 'Show'} Filters</span>
              </button>
            </div>
          )}
        </div>

        {/* View Mode Tabs */}
        <div className="mt-4 flex items-center gap-1 border-b border-gray-200">
          <button
            onClick={() => setViewMode('processed')}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${viewMode === 'processed'
                ? 'bg-white text-primary-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4" />
              <span>Processed Assets</span>
            </div>
          </button>
          <button
            onClick={() => setViewMode('sources')}
            className={`
              px-4 py-2 text-sm font-medium rounded-t-lg transition-colors
              ${viewMode === 'sources'
                ? 'bg-white text-primary-700 border-t border-l border-r border-gray-200 -mb-px'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }
            `}
          >
            <div className="flex items-center gap-2">
              <Table className="w-4 h-4" />
              <span>Source Databases</span>
            </div>
          </button>
        </div>

        {/* Search Bar (only for processed view) */}
        {viewMode === 'processed' && (
          <div className="mt-4">
            <GlobalSearchBar
              value={searchQuery}
              placeholder="Search tables, workflows, descriptions…"
              onChange={setSearchQuery}
            />
          </div>
        )}

        {/* Active Filter Chips */}
        {viewMode === 'processed' && (selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0 || searchQuery) && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-gray-600">Active Filters:</span>

            {/* Layer Chips */}
            {selectedLayers.map(layer => (
              <button
                key={layer}
                onClick={() => toggleLayer(layer)}
                className="flex items-center gap-1.5 px-3 py-1 bg-primary-50 border border-primary-200 text-primary-700 rounded-full text-xs font-medium hover:bg-primary-100 transition-colors"
              >
                <span className="capitalize">{layer}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Workflow Chips */}
            {selectedWorkflows.map(workflowId => {
              const workflow = workflows.find(w => w.id === workflowId);
              return (
                <button
                  key={workflowId}
                  onClick={() => toggleWorkflow(workflowId)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <span className="max-w-[150px] truncate">{workflow?.name || workflowId}</span>
                  <X className="w-3 h-3" />
                </button>
              );
            })}

            {/* Quality Status Chips */}
            {selectedQualityStatus.map(status => (
              <button
                key={status}
                onClick={() => toggleQualityStatus(status)}
                className={`flex items-center gap-1.5 px-3 py-1 border rounded-full text-xs font-medium hover:opacity-80 transition-opacity ${
                  status === 'healthy'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : status === 'issues'
                    ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <span className="capitalize">{status.replace('-', ' ')}</span>
                <X className="w-3 h-3" />
              </button>
            ))}

            {/* Search Query Chip */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 border border-purple-200 text-purple-700 rounded-full text-xs font-medium hover:bg-purple-100 transition-colors"
              >
                <Search className="w-3 h-3" />
                <span className="max-w-[150px] truncate">"{searchQuery}"</span>
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Clear All Button */}
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Content - Conditional based on view mode */}
      {viewMode === 'sources' ? (
        <div className="flex-1 overflow-hidden">
          <SourceDatabasesView />
        </div>
      ) : (
        <>
          {/* Three-Panel Layout for Processed Assets */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel: Filters */}
            {showFilters && (
          <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
            <div className="p-4 space-y-6">
              {/* Layer Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Medallion Layer</h3>
                <div className="space-y-2">
                  {(['bronze', 'silver', 'gold'] as Layer[]).map(layer => (
                    <label key={layer} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLayers.includes(layer)}
                        onChange={() => toggleLayer(layer)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <LayerBadge layer={layer} size="sm" />
                      <span className="text-sm text-gray-600">
                        ({stats?.by_layer[layer] || 0})
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Workflow Filter */}
              {workflows.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Workflow</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {workflows.map(workflow => (
                      <label key={workflow.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWorkflows.includes(workflow.id)}
                          onChange={() => toggleWorkflow(workflow.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 truncate">{workflow.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Quality Filter */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quality Status</h3>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQualityStatus.includes('healthy')}
                      onChange={() => toggleQualityStatus('healthy')}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Healthy (95-100%)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQualityStatus.includes('issues')}
                      onChange={() => toggleQualityStatus('issues')}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">Has Issues (&lt;95%)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQualityStatus.includes('no-rules')}
                      onChange={() => toggleQualityStatus('no-rules')}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">No Rules</span>
                  </label>
                </div>
              </div>

              {/* Clear Filters */}
              {(selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0) && (
                <button
                  onClick={clearAllFilters}
                  className="w-full px-3 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Middle Panel: Asset List */}
        <div className="w-96 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="p-4 bg-white border-b border-gray-200">
            <div className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{assets.length}</span> assets
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {loading ? (
              <div className="text-center py-12 text-gray-500">Loading assets...</div>
            ) : assets.length === 0 ? (
              <div className="text-center py-12 px-6 text-gray-500">
                <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {searchQuery || selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0
                    ? 'No Assets Match Your Filters'
                    : 'No Data Assets Yet'}
                </h3>
                <p className="text-sm text-gray-600 mb-6">
                  {searchQuery || selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0
                    ? 'Try adjusting your filters or search query'
                    : 'Your data catalog will appear here once you run your first workflow'}
                </p>

                {!(searchQuery || selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0) && (
                  <div className="space-y-3 max-w-xs mx-auto">
                    <button
                      onClick={() => router.push('/workflows')}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                    >
                      <Workflow className="w-4 h-4" />
                      Create Your First Workflow
                    </button>
                    <div className="text-xs text-gray-500">
                      <div className="flex items-center gap-2 justify-center mb-2">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="font-semibold">Quick Start:</span>
                      </div>
                      <ol className="text-left space-y-1 pl-8 list-decimal">
                        <li>Upload a CSV file</li>
                        <li>AI detects schema in 3 seconds</li>
                        <li>Configure Bronze/Silver/Gold</li>
                        <li>Run workflow</li>
                        <li>Data appears here!</li>
                      </ol>
                    </div>
                  </div>
                )}

                {(searchQuery || selectedLayers.length > 0 || selectedWorkflows.length > 0 || selectedQualityStatus.length > 0) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 text-sm text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              assets.map(asset => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedAsset?.id === asset.id}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))
            )}
          </div>
        </div>

        {/* Right Panel: Asset Details */}
        <div className="flex-1 bg-white overflow-hidden flex flex-col">
          {selectedAsset ? (
            <>
              {/* Breadcrumb & Actions */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <LayerBadge layer={selectedAsset.layer} size="sm" />
                    <span>/</span>
                    <span className="font-medium text-gray-900">{selectedAsset.table_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedAsset.file_path || '')}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copy path"
                    >
                      <Copy className="w-4 h-4 text-gray-600" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Download">
                      <Download className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex items-center gap-1 mt-4 overflow-x-auto">
                  {[
                    { id: 'overview', label: 'Overview', icon: Database },
                    { id: 'schema', label: 'Schema', icon: Table },
                    { id: 'sample', label: 'Sample', icon: FileText },
                    { id: 'quality', label: 'Quality', icon: null },
                    { id: 'lineage', label: 'Lineage', icon: null },
                    { id: 'jobs', label: 'Jobs', icon: null },
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as DetailTab)}
                        className={`
                          flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                          ${activeTab === tab.id
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-600 hover:bg-gray-100'
                          }
                        `}
                      >
                        {Icon && <Icon className="w-4 h-4" />}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'overview' && (
                  <OverviewTab asset={selectedAsset} details={assetDetails} />
                )}
                {activeTab === 'schema' && (
                  <SchemaTab asset={selectedAsset} />
                )}
                {activeTab === 'sample' && (
                  <SampleTab asset={selectedAsset} />
                )}
                {activeTab === 'quality' && (
                  <QualityTab asset={selectedAsset} details={assetDetails} />
                )}
                {activeTab === 'lineage' && (
                  <LineageTab asset={selectedAsset} details={assetDetails} />
                )}
                {activeTab === 'jobs' && (
                  <JobsTab asset={selectedAsset} details={assetDetails} />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p>Select an asset to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

// Tab Components
function OverviewTab({ asset, details }: any) {
  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900">Description</h3>
          <button className="p-1 hover:bg-gray-100 rounded">
            <Edit className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          {asset.description || 'No description available'}
        </p>
      </div>

      {/* Metadata Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Owner</div>
          <div className="font-medium text-gray-900">{asset.owner || '—'}</div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Environment</div>
          <EnvironmentBadge environment={asset.environment} />
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Created</div>
          <div className="font-medium text-gray-900">
            {formatDistanceToNow(new Date(asset.created_at), { addSuffix: true })}
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-lg">
          <div className="text-sm text-gray-600 mb-1">Last Updated</div>
          <div className="font-medium text-gray-900">
            {formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true })}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Statistics</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-2xl font-bold text-primary-700">
              {(asset.row_count || 0).toLocaleString()}
            </div>
            <div className="text-sm text-primary-600 mt-1">Total Rows</div>
          </div>
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-2xl font-bold text-primary-700">
              {asset.schema?.length || 0}
            </div>
            <div className="text-sm text-primary-600 mt-1">Columns</div>
          </div>
          <div className="p-4 bg-primary-50 rounded-lg">
            <div className="text-2xl font-bold text-primary-700">
              {(asset.file_size / 1024 / 1024).toFixed(2)} MB
            </div>
            <div className="text-sm text-primary-600 mt-1">File Size</div>
          </div>
        </div>
      </div>

      {/* File Path */}
      {asset.file_path && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">File Path</h3>
          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg font-mono text-sm">
            <code className="flex-1 text-gray-700 truncate">{asset.file_path}</code>
            <button
              onClick={() => navigator.clipboard.writeText(asset.file_path)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>
      )}

      {/* Tags */}
      {asset.tags && asset.tags.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {asset.tags.map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaTab({ asset }: any) {
  const schema = asset.schema || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">
          {schema.length} Columns
        </h3>
        <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Schema
        </button>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Column Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Data Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Nullable</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {schema.map((col: any, idx: number) => (
              <tr key={idx} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{col.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{col.type}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {col.nullable ? 'Yes' : 'No'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SampleTab({ asset }: any) {
  const [sampleData, setSampleData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchSampleData = async () => {
      if (!asset?.file_path) {
        setError('No file path available for this asset');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const response = await fetch(`/api/data-assets/${asset.id}/sample?limit=100`);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch sample data');
        }

        const data = await response.json();
        setSampleData(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load sample data');
      } finally {
        setLoading(false);
      }
    };

    fetchSampleData();
  }, [asset?.id, asset?.file_path]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-12 h-12 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        <p className="text-sm text-gray-600">Loading sample data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
          <X className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Sample Data</h3>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!sampleData || !sampleData.rows || sampleData.rows.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sample Data Available</h3>
        <p className="text-sm text-gray-600">This asset does not contain any data</p>
      </div>
    );
  }

  const { schema, rows, total_rows_in_sample, total_columns } = sampleData;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Sample Data Preview</h3>
          <p className="text-xs text-gray-600 mt-1">
            Showing {total_rows_in_sample} of {asset.row_count?.toLocaleString() || 0} rows · {total_columns} columns
          </p>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export Sample
        </button>
      </div>

      {/* Data Table */}
      <div className="border border-gray-200 rounded-lg overflow-auto max-h-[600px]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 bg-gray-100">
                #
              </th>
              {schema.map((col: any, idx: number) => (
                <th
                  key={idx}
                  className="px-3 py-2 text-left text-xs font-semibold text-gray-700 border-r border-gray-200 last:border-r-0 whitespace-nowrap"
                >
                  <div>{col.name}</div>
                  <div className="text-[10px] font-normal text-gray-500 mt-0.5">{col.type}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row: any, rowIdx: number) => (
              <tr key={rowIdx} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-xs text-gray-500 border-r border-gray-200 bg-gray-50 font-medium">
                  {rowIdx + 1}
                </td>
                {schema.map((col: any, colIdx: number) => {
                  const value = row[col.name];
                  const displayValue = value === null || value === undefined
                    ? <span className="text-gray-400 italic">null</span>
                    : typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);

                  return (
                    <td
                      key={colIdx}
                      className="px-3 py-2 text-xs text-gray-900 border-r border-gray-200 last:border-r-0 max-w-xs truncate"
                      title={typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="text-xs text-gray-500 text-center py-2">
        Scroll horizontally to view more columns · Click on cells to see full content
      </div>
    </div>
  );
}

function QualityTab({ asset, details }: any) {
  const qualityRules = details?.qualityRules || [];

  return (
    <div className="space-y-6">
      {/* Overall Score */}
      <div className="p-6 bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg">
        <div className="text-center">
          <div className="text-4xl font-bold text-primary-700 mb-2">
            {asset.quality_score?.toFixed(0) || 0}%
          </div>
          <div className="text-sm text-primary-600">Overall Quality Score</div>
          <div className="text-xs text-gray-600 mt-1">
            Based on {qualityRules.length} active rules
          </div>
        </div>
      </div>

      {/* Rules Table */}
      {qualityRules.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quality Rules</h3>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Rule</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Column</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Severity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {qualityRules.map((rule: any) => (
                  <tr key={rule.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{rule.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.column_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{rule.rule_type}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        rule.severity === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {rule.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>No quality rules configured</p>
          <p className="text-sm mt-1">Add rules in the workflow job configuration</p>
        </div>
      )}
    </div>
  );
}

function LineageTab({ asset, details }: any) {
  const lineage = details?.lineage;

  return (
    <div className="space-y-6">
      {/* Mini Lineage Preview */}
      <div className="p-6 border border-gray-200 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Lineage Graph</h3>
        {lineage && lineage.nodes.length > 0 ? (
          <div className="flex items-center justify-center gap-4 py-8">
            {lineage.nodes.filter((n: any) => n.type === 'source').map((node: any) => (
              <div key={node.id} className="text-center">
                <div className="px-4 py-2 bg-accent-orange/10 text-accent-orange border border-accent-orange/30 rounded-lg text-sm">
                  {node.table_name}
                </div>
                <div className="text-xs text-gray-500 mt-1">Bronze</div>
              </div>
            ))}

            <span className="text-2xl text-gray-300">→</span>

            <div className="text-center">
              <div className="px-4 py-2 bg-primary-100 text-primary-700 border border-primary-300 rounded-lg text-sm font-medium">
                {asset.table_name}
              </div>
              <div className="text-xs text-gray-500 mt-1">This Asset</div>
            </div>

            {lineage.nodes.filter((n: any) => n.type === 'target').length > 0 && (
              <>
                <span className="text-2xl text-gray-300">→</span>
                {lineage.nodes.filter((n: any) => n.type === 'target').map((node: any) => (
                  <div key={node.id} className="text-center">
                    <div className="px-4 py-2 bg-gradient-to-r from-primary-600 to-secondary-500 text-white rounded-lg text-sm">
                      {node.table_name}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Gold</div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No lineage information available</p>
          </div>
        )}
      </div>

      <div className="text-center">
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90">
          <ExternalLink className="w-4 h-4" />
          View Full Lineage
        </button>
        <p className="text-xs text-gray-500 mt-2">Opens interactive lineage graph</p>
      </div>
    </div>
  );
}

function JobsTab({ asset, details }: any) {
  const executions = details?.executions || [];

  return (
    <div className="space-y-6">
      {/* Producing Job */}
      {asset.workflow_name && (
        <div className="p-4 bg-primary-50 rounded-lg">
          <div className="text-sm text-primary-600 mb-1">Produced By</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-primary-900">{asset.workflow_name}</div>
              <div className="text-sm text-primary-700">{asset.job_name}</div>
            </div>
            <button className="px-3 py-1 text-sm text-primary-600 hover:bg-primary-100 rounded">
              View Workflow →
            </button>
          </div>
        </div>
      )}

      {/* Recent Executions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Executions</h3>
        {executions.length > 0 ? (
          <div className="space-y-2">
            {executions.map((exec: any) => (
              <div key={exec.id} className="p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      exec.status === 'completed'
                        ? 'bg-green-100 text-green-700'
                        : exec.status === 'failed'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {exec.status}
                    </span>
                    <span className="text-sm text-gray-600">
                      {formatDistanceToNow(new Date(exec.started_at), { addSuffix: true })}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {exec.records_processed?.toLocaleString() || 0} records
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No execution history available</p>
          </div>
        )}
      </div>
    </div>
  );
}
