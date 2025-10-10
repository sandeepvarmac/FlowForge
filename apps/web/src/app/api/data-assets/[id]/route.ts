/**
 * API Route: GET /api/data-assets/[id]
 * Returns detailed information about a specific data asset
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataAssetsService } from '@/lib/services/data-assets-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const service = new DataAssetsService();

    const asset = service.getAssetById(id);

    if (!asset) {
      service.close();
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Get quality rules
    const qualityRules = service.getAssetQualityRules(id);

    // Get recent executions
    const executions = service.getAssetExecutions(id, 10);

    // Get lineage
    const lineage = service.getLineageGraph(id);

    service.close();

    return NextResponse.json({
      asset,
      qualityRules,
      executions,
      lineage,
    });
  } catch (error: any) {
    console.error('Error fetching asset details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch asset details', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();

    const service = new DataAssetsService();

    // Validate asset exists
    const asset = service.getAssetById(id);
    if (!asset) {
      service.close();
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      );
    }

    // Update allowed fields
    const updates: any = {};
    if (body.description !== undefined) updates.description = body.description;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.owner !== undefined) updates.owner = body.owner;

    service.updateAsset(id, updates);

    // Get updated asset
    const updatedAsset = service.getAssetById(id);

    service.close();

    return NextResponse.json({ asset: updatedAsset });
  } catch (error: any) {
    console.error('Error updating asset:', error);
    return NextResponse.json(
      { error: 'Failed to update asset', details: error.message },
      { status: 500 }
    );
  }
}
