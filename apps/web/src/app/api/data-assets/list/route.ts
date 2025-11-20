/**
 * API Route: GET /api/data-assets/list
 * Returns paginated list of data assets with filters
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataAssetsService } from '@/lib/services/data-assets-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query params
    const layers = searchParams.get('layers')?.split(',').filter(Boolean) as any[] || [];
    const environments = searchParams.get('environments')?.split(',').filter(Boolean) as any[] || ['prod'];
    const workflowIds = searchParams.get('workflowIds')?.split(',').filter(Boolean) || [];
    const assetTypes = searchParams.get('assetTypes')?.split(',').filter(Boolean) || [];
    const qualityStatus = searchParams.get('qualityStatus')?.split(',').filter(Boolean) as any[] || [];
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const service = new DataAssetsService();

    const result = service.getAssets({
      layers,
      environments,
      workflowIds,
      assetTypes,
      qualityStatus,
      tags,
      search,
      page,
      limit,
    });

    // Get workflows for filter dropdown
    const workflows = service.getWorkflows();

    // Get stats for current environment
    const stats = service.getAssetStats(environments[0] || 'prod');

    // Workflow-centric groups for explorer view
    const workflowGroups = service.getWorkflowAssetGroups({
      layers,
      environments,
      workflowIds,
      qualityStatus,
      tags,
      search,
    });

    return NextResponse.json({
      assets: result.assets,
      workflows,
      stats,
      pagination: result.pagination,
      workflowGroups,
    });
  } catch (error: any) {
    console.error('Error fetching data assets:', error);
    return NextResponse.json(
      { error: 'Failed to fetch data assets', details: error.message },
      { status: 500 }
    );
  }
}
