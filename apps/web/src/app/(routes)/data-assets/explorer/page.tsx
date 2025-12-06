'use client';

/**
 * Data Assets Explorer - Microsoft Purview-Inspired Design with Hierarchical Navigation
 * Left Sidebar: Workflow tree navigation (collapsible)
 * Main Panel: Asset cards with pagination
 * Header: Consistent across browse and detail views
 */

import React from 'react';
import { Search, ChevronRight, ChevronDown, Database, Layers, CheckCircle2, AlertCircle, Clock, ArrowLeft, Table, FileText, TrendingUp, GitBranch, Briefcase, FolderTree, Workflow } from 'lucide-react';
import { LayerBadge } from '@/components/data-assets/LayerBadge';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'next/navigation';
import { DataAssetsLayout } from '@/components/data-assets';

type Layer = 'bronze' | 'silver' | 'gold';
type Environment = 'dev' | 'qa' | 'uat' | 'prod';
type DetailTab = 'overview' | 'schema' | 'preview' | 'quality' | 'lineage' | 'jobs';

export default function DataAssetsExplorerPage() {
  const router = useRouter();

  // State
  const [selectedEnvironment, setSelectedEnvironment] = React.useState<Environment>('dev');
  const [selectedLayer, setSelectedLayer] = React.useState<Layer | 'all'>('all');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedAsset, setSelectedAsset] = React.useState<any>(null);
  const [activeTab, setActiveTab] = React.useState<DetailTab>('overview');

  // New: Workflow/Job selection state
  const [selectedWorkflowId, setSelectedWorkflowId] = React.useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [expandedWorkflows, setExpandedWorkflows] = React.useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const ITEMS_PER_PAGE = 30;

  // Data state
  const [workflowGroups, setWorkflowGroups] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [assetDetails, setAssetDetails] = React.useState<any>(null);

  // Load workflow groups
  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('environments', selectedEnvironment);

      if (selectedLayer !== 'all') {
        params.set('layers', selectedLayer);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await fetch(`/api/data-assets/list?${params}`);
      const data = await response.json();

      setWorkflowGroups(data.workflowGroups || []);

      // Auto-select first workflow if none selected
      if (!selectedWorkflowId && data.workflowGroups?.length > 0) {
        setSelectedWorkflowId(data.workflowGroups[0].workflowId);
        // Auto-expand first workflow
        setExpandedWorkflows(new Set([data.workflowGroups[0].workflowId]));
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironment, selectedLayer, searchQuery, selectedWorkflowId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Get assets to display based on selection
  const displayAssets = React.useMemo(() => {
    if (!selectedWorkflowId) return [];

    const workflow = workflowGroups.find(w => w.workflowId === selectedWorkflowId);
    if (!workflow) return [];

    // If specific job selected, show only that job's datasets
    if (selectedJobId) {
      const job = workflow.jobs.find((j: any) => j.jobId === selectedJobId);
      return job?.datasets || [];
    }

    // Otherwise show all datasets from all jobs in workflow
    return workflow.jobs.flatMap((job: any) => job.datasets);
  }, [workflowGroups, selectedWorkflowId, selectedJobId]);

  // Paginated assets
  const paginatedAssets = React.useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return displayAssets.slice(startIndex, endIndex);
  }, [displayAssets, currentPage]);

  const totalPages = Math.ceil(displayAssets.length / ITEMS_PER_PAGE);

  // Reset to page 1 when selection changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [selectedWorkflowId, selectedJobId]);

  // Helper: Toggle workflow expansion
  const toggleWorkflow = (workflowId: string) => {
    const newExpanded = new Set(expandedWorkflows);
    if (newExpanded.has(workflowId)) {
      newExpanded.delete(workflowId);
    } else {
      newExpanded.add(workflowId);
    }
    setExpandedWorkflows(newExpanded);
  };

  // Render sidebar (always visible)
  const renderSidebar = () => (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
          <FolderTree className="w-4 h-4" />
          Workflows & Jobs
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-gray-500 text-sm">Loading workflows...</div>
        ) : workflowGroups.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">No workflows found</div>
        ) : (
          <div className="py-2">
            {workflowGroups.map((workflow) => (
              <div key={workflow.workflowId} className="mb-1">
                {/* Workflow Header */}
                <button
                  onClick={() => {
                    toggleWorkflow(workflow.workflowId);
                    setSelectedWorkflowId(workflow.workflowId);
                    setSelectedJobId(null);
                    setSelectedAsset(null); // Clear selection when switching workflows
                  }}
                  className={`w-full px-4 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                    selectedWorkflowId === workflow.workflowId && !selectedJobId
                      ? 'bg-primary-50 border-l-4 border-primary-600'
                      : ''
                  }`}
                >
                  {expandedWorkflows.has(workflow.workflowId) ? (
                    <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
                  )}
                  <Workflow className="w-4 h-4 text-primary-600 flex-shrink-0" />
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900 truncate">{workflow.workflowName}</div>
                    <div className="text-xs text-gray-500">
                      {workflow.jobCount} jobs · {workflow.datasetCount} datasets
                    </div>
                  </div>
                </button>

                {/* Jobs List (when expanded) */}
                {expandedWorkflows.has(workflow.workflowId) && (
                  <div className="bg-gray-50">
                    {workflow.jobs.map((job: any) => (
                      <button
                        key={job.jobId}
                        onClick={() => {
                          setSelectedWorkflowId(workflow.workflowId);
                          setSelectedJobId(job.jobId);
                          setSelectedAsset(null); // Clear selection when switching jobs
                        }}
                        className={`w-full pl-12 pr-4 py-2 flex items-center gap-2 hover:bg-gray-100 transition-colors ${
                          selectedJobId === job.jobId
                            ? 'bg-primary-100 border-l-4 border-primary-600'
                            : ''
                        }`}
                      >
                        <Database className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 text-left">
                          <div className="text-sm text-gray-900 truncate">{job.jobName}</div>
                          <div className="text-xs text-gray-500">{job.datasets.length} datasets</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Filters bar (replaces the old main header)
  const renderFiltersBar = () => (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        {/* Environment & Layer Filters */}
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

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search workflows, jobs, or data assets..."
          className="w-full pl-12 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>
    </div>
  );

  // If asset is selected, show detail view
  if (selectedAsset) {
    return (
      <DataAssetsLayout>
        <div className="h-full flex flex-col bg-gray-50">
          {/* Filters Bar */}
          {renderFiltersBar()}

          {/* Main Content: Sidebar + Detail Panel */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            {renderSidebar()}

            {/* Detail Panel with its own header and tabs */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Detail Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4">
                <div className="flex items-center gap-4 mb-4">
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Back to asset list"
                  >
                    <ArrowLeft className="w-5 h-5 text-gray-600" />
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-semibold text-gray-900">{selectedAsset.table_name}</h2>
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

                {/* Detail Tabs */}
                <div className="flex items-center gap-1">
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

              {/* Detail Content */}
              <div className="flex-1 overflow-hidden p-6 bg-gray-50">
                <div className="h-full min-h-0">
                  {activeTab === 'overview' && <OverviewTab asset={selectedAsset} details={assetDetails} />}
                  {activeTab === 'schema' && <SchemaTab asset={selectedAsset} />}
                  {activeTab === 'preview' && <SampleTab asset={selectedAsset} />}
                  {activeTab === 'quality' && <QualityTab asset={selectedAsset} details={assetDetails} />}
                  {activeTab === 'lineage' && <LineageTab asset={selectedAsset} details={assetDetails} />}
                  {activeTab === 'jobs' && <JobsTab asset={selectedAsset} details={assetDetails} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DataAssetsLayout>
    );
  }

  // Browse view with Sidebar + Main Panel
  return (
    <DataAssetsLayout>
      <div className="h-full flex flex-col bg-gray-50">
        {/* Filters Bar */}
        {renderFiltersBar()}

        {/* Main Content Area: Sidebar + Assets Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Reuse same component */}
          {renderSidebar()}

          {/* Main Panel: Asset Cards with Pagination */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  {selectedJobId
                    ? workflowGroups
                        .find(w => w.workflowId === selectedWorkflowId)
                        ?.jobs.find((j: any) => j.jobId === selectedJobId)?.jobName
                    : workflowGroups.find(w => w.workflowId === selectedWorkflowId)?.workflowName || 'All Assets'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {displayAssets.length} asset{displayAssets.length !== 1 ? 's' : ''} found
                  {totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
                </p>
              </div>
            </div>

            {/* Assets Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">Loading assets...</div>
                </div>
              ) : displayAssets.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center py-12 bg-white rounded-lg border border-gray-200 px-8">
                    <Database className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-600">No assets found</p>
                    <p className="text-sm text-gray-500 mt-2">Try selecting a different workflow or adjusting filters</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedAssets.map(asset => (
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

                      <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
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
                        <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
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

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, displayAssets.length)} of {displayAssets.length} assets
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DataAssetsLayout>
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full">
          <thead className="border-b border-primary-700 sticky top-0 z-20 bg-primary text-white shadow-md">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Column Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Data Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                Nullable
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {schema.columns.map((column: any, index: number) => (
              <tr key={index} className="hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                <td className="px-6 py-4 text-sm font-medium text-foreground">{column.name}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground font-mono">{column.type}</td>
                <td className="px-6 py-4 text-sm text-muted-foreground">{column.nullable ? 'Yes' : 'No'}</td>
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
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden h-full flex flex-col">
      <div className="px-6 py-3 bg-muted/30 text-foreground border-b border-gray-200 flex-shrink-0">
        <p className="text-sm text-gray-600">
          Showing {sampleData.rows.length} of {asset.row_count?.toLocaleString() || 'unknown'} rows
        </p>
      </div>
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full">
          <thead className="border-b border-primary-700 sticky top-0 z-20 bg-primary text-white shadow-md">
            <tr>
              {sampleData.columns.map((column: string) => (
                <th
                  key={column}
                  className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-primary-100">
            {sampleData.rows.map((row: any, rowIndex: number) => (
              <tr key={rowIndex} className="hover:bg-primary-100/60 odd:bg-primary-50 even:bg-white">
                {sampleData.columns.map((column: string) => (
                  <td key={column} className="px-6 py-4 text-sm text-foreground whitespace-nowrap">
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
