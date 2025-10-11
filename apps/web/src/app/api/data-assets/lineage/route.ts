/**
 * API Route: GET /api/data-assets/lineage
 * Returns lineage graph data for visualization
 */

import { NextRequest, NextResponse } from 'next/server';
import { DataAssetsService } from '@/lib/services/data-assets-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get('assetId') || undefined;

    const service = new DataAssetsService();
    const lineage = service.getLineageGraph(assetId);

    return NextResponse.json({ lineage });
  } catch (error: any) {
    console.error('Error fetching lineage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lineage', details: error.message },
      { status: 500 }
    );
  }
}
