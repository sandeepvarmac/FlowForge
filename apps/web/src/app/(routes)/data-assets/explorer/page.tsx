'use client';

/**
 * Data Assets Explorer - Microsoft Purview-Inspired Design
 * Clean, full-width layout with prominent search and card-based browsing
 */

import React from 'react';
import { Search, ChevronRight, Database, Layers, CheckCircle2, AlertCircle, Clock, ArrowLeft, Table, FileText, TrendingUp, GitBranch, Briefcase } from 'lucide-react';
import { LayerBadge } from '@/components/data-assets/LayerBadge';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';

type Layer = 'bronze' | 'silver' | 'gold';
type Environment = 'dev' | 'qa' | 'uat' | 'prod';
type DetailTab = 'overview' | 'schema' | 'preview' | 'quality' | 'lineage' | 'jobs';

export default function DataAssetsExplorerPage() {
  const router = useRouter();

  // State
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<Environment>('prod');
  const [selectedLayer, setSelectedLayer] = React.useState<Layer | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAsset, setSelectedAsset] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');

  // Data state
  const [assets, setAssets] = React.useState<any[]>([]);
  const [workflows, setWorkflows] = React.useState<any[]>([]);
  const [stats, setStats] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [assetDetails, setAssetDetails] = React.useState<any>(null);

  // Load assets
  const loadAssets = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('environments', selectedEnvironment);

      if (selectedLayer !== 'all') {
        params.set('layers', selectedLayer);
      }

      const response = await fetch(`/api/data-assets/list?${params}`);
      const data = await response.json();

      setAssets(data.assets || []);
      setWorkflows(data.workflows || []);
      setStats(data.stats || null);
    } catch (error) {
      console.error('Failed to load assets:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, selectedLayer]);

  React.useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Load asset details when selected
  React.useEffect(() => {
    if (!selectedAsset) {
      setAssetDetails(null);
      return;
    }

    const loadDetails = async () => {
      try {
        const response = await fetch(`/api/data-assets/${selectedAsset.id}`);
        const data = await response.json();
        setAssetDetails(data);
      } catch (error) {
        console.error('Failed to load asset details:', error);
      }
    };

    loadDetails();
  }, [selectedAsset]);

  // Filter assets by search
  const filteredAssets = React.useMemo(() => {
    if (!searchQuery) return assets;

    const query = searchQuery.toLowerCase();
    return assets.filter(asset =>
      asset.table_name.toLowerCase().includes(query) ||
      asset.description?.toLowerCase().includes(query)
    );
  }, [assets, searchQuery]);

  // Calculate layer stats
  const layerStats = React.useMemo(() => {
    const bronze = assets.filter(a => a.layer === 'bronze').length;
    const silver = assets.filter(a => a.layer === 'silver').length;
    const gold = assets.filter(a => a.layer === 'gold').length;

    return { bronze, silver, gold, total: assets.length };
  }, [assets]);

  // If asset is selected, show detail view
  if (selectedAsset) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedAsset(null)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">{selectedAsset.table_name}</h1>
                <LayerBadge layer={selectedAsset.layer} />
              </div>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                <span>Updated {formatDistanceToNow(new Date(selectedAsset.updated_at), { addSuffix: true })}</span>
                <span>•</span>
                <span>{selectedAsset.row_count?.toLocaleString()} rows</span>
                {selectedAsset.file_size && (
                  <>
                    <span>•</span>
                    <span>{(selectedAsset.file_size / 1024 / 1024).toFixed(2)} MB</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mt-4">
            {[
              { id: 'overview', label: 'Overview', icon: Database },
              { id: 'schema', label: 'Schema', icon: Table },
              { id: 'preview', label: 'Preview', icon: FileText },
              { id: 'quality', label: 'Quality', icon: CheckCircle2 },
              { id: 'lineage', label: 'Lineage', icon: GitBranch },
              { id: 'jobs', label: 'Jobs', icon: Briefcase },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as DetailTab)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && <OverviewTab asset={selectedAsset} details={assetDetails} />}
          {activeTab === 'schema' && <SchemaTab asset={selectedAsset} />}
          {activeTab === 'preview' && <SampleTab asset={selectedAsset} />}
          {activeTab === 'quality' && <QualityTab asset={selectedAsset} details={assetDetails} />}
          {activeTab === 'lineage' && <LineageTab asset={selectedAsset} details={assetDetails} />}
          {activeTab === 'jobs' && <JobsTab asset={selectedAsset} details={assetDetails} />}
        </div>
      </div>
    );
  }

  // Browse view
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header with Search */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-semibold text-gray-900 mb-4">Data Assets</h1>

          {/* Search Bar */}
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search data assets by name or description..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-4">
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
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto">
          {/* Layer Statistics Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div
              onClick={() => setSelectedLayer('all')}
              className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedLayer === 'all'
                  ? 'border-primary-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <Layers className="w-5 h-5 text-gray-600" />
                <span className="text-2xl font-bold text-gray-900">{layerStats.total}</span>
              </div>
              <div className="text-sm font-medium text-gray-600">All Assets</div>
            </div>

            <div
              onClick={() => setSelectedLayer('bronze')}
              className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedLayer === 'bronze'
                  ? 'border-orange-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-5 h-5 rounded bg-orange-500" />
                <span className="text-2xl font-bold text-gray-900">{layerStats.bronze}</span>
              </div>
              <div className="text-sm font-medium text-gray-600">Bronze Layer</div>
            </div>

            <div
              onClick={() => setSelectedLayer('silver')}
              className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedLayer === 'silver'
                  ? 'border-blue-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-5 h-5 rounded bg-blue-500" />
                <span className="text-2xl font-bold text-gray-900">{layerStats.silver}</span>
              </div>
              <div className="text-sm font-medium text-gray-600">Silver Layer</div>
            </div>

            <div
              onClick={() => setSelectedLayer('gold')}
              className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-all ${
                selectedLayer === 'gold'
                  ? 'border-yellow-500 shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="w-5 h-5 rounded bg-yellow-500" />
                <span className="text-2xl font-bold text-gray-900">{layerStats.gold}</span>
              </div>
              <div className="text-sm font-medium text-gray-600">Gold Layer</div>
            </div>
          </div>

          {/* Assets Grid */}
          {loading ? (
            <div className="text-center py-12 text-gray-500">Loading assets...</div>
          ) : filteredAssets.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600">No assets found</p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAssets.map(asset => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="bg-white rounded-lg border border-gray-200 p-4 hover:border-primary-500 hover:shadow-md transition-all text-left group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Database className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                      <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {asset.table_name}
                      </h3>
                    </div>
                    <LayerBadge layer={asset.layer} size="sm" />
                  </div>

                  {asset.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{asset.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Table className="w-3.5 h-3.5" />
                      <span>{asset.row_count?.toLocaleString() || 0} rows</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true })}</span>
                    </div>
                  </div>

                  {asset.quality_score !== undefined && (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                      {asset.quality_score >= 90 ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : asset.quality_score >= 70 ? (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      )}
                      <span className="text-xs font-medium text-gray-600">
                        Quality: {asset.quality_score}%
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Tab Components (reusing existing ones from the old code)
function OverviewTab({ asset, details }: any) {
  return (
    <div className="max-w-4xl">
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Asset Information</h2>

        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">Layer</dt>
            <dd className="text-sm text-gray-900">
              <LayerBadge layer={asset.layer} />
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">Row Count</dt>
            <dd className="text-sm text-gray-900">{asset.row_count?.toLocaleString() || 'N/A'}</dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">File Size</dt>
            <dd className="text-sm text-gray-900">
              {asset.file_size ? `${(asset.file_size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">Created</dt>
            <dd className="text-sm text-gray-900">
              {new Date(asset.created_at).toLocaleDateString()}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">Last Updated</dt>
            <dd className="text-sm text-gray-900">
              {formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true })}
            </dd>
          </div>

          {asset.owner && (
            <div>
              <dt className="text-sm font-medium text-gray-600 mb-1">Owner</dt>
              <dd className="text-sm text-gray-900">{asset.owner}</dd>
            </div>
          )}
        </dl>

        {asset.description && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-600 mb-2">Description</h3>
            <p className="text-sm text-gray-900">{asset.description}</p>
          </div>
        )}
      </div>

      {asset.file_path && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Storage</h2>
          <div>
            <dt className="text-sm font-medium text-gray-600 mb-1">File Path</dt>
            <dd className="text-xs text-gray-700 font-mono bg-gray-50 p-2 rounded border border-gray-200 break-all">
              {asset.file_path}
            </dd>
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaTab({ asset }: any) {
  const [schema, setSchema] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchSchema = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/data-assets/${asset.id}/schema`);
        const data = await response.json();
        setSchema(data);
      } catch (error) {
        console.error('Failed to fetch schema:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchema();
  }, [asset.id]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin w-8 h-8 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        <p className="text-sm text-gray-600">Loading schema...</p>
      </div>
    );
  }

  if (!schema?.columns || schema.columns.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Table className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">No schema information available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Column Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                Nullable
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {schema.columns.map((column: any, index: number) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{column.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600 font-mono">{column.type}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{column.nullable ? 'Yes' : 'No'}</td>
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
        <div className="animate-spin w-8 h-8 mx-auto mb-4 border-4 border-primary-200 border-t-primary-600 rounded-full"></div>
        <p className="text-sm text-gray-600">Loading preview data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg border border-red-200 p-12 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-600" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Preview</h3>
        <p className="text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (!sampleData?.rows || sampleData.rows.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p className="text-gray-600">No preview data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
        <p className="text-sm text-gray-600">
          Showing {sampleData.rows.length} of {asset.row_count?.toLocaleString() || 'unknown'} rows
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {sampleData.columns.map((column: string) => (
                <th
                  key={column}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sampleData.rows.map((row: any, rowIndex: number) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {sampleData.columns.map((column: string) => (
                  <td key={column} className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                    {row[column] !== null && row[column] !== undefined ? String(row[column]) : (
                      <span className="text-gray-400 italic">null</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualityTab({ asset, details }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <p className="text-gray-600">Quality rules will be displayed here</p>
    </div>
  );
}

function LineageTab({ asset, details }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <GitBranch className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <p className="text-gray-600">Lineage graph will be displayed here</p>
    </div>
  );
}

function JobsTab({ asset, details }: any) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <Briefcase className="w-12 h-12 mx-auto mb-4 text-gray-400" />
      <p className="text-gray-600">Job execution history will be displayed here</p>
    </div>
  );
}
