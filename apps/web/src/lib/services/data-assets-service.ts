/**
 * Data Assets Service
 * Business logic for data catalog and asset management
 */

import Database from 'better-sqlite3';
import { getDatabase } from '@/lib/db';

export interface DataAsset {
  id: string;
  layer: 'bronze' | 'silver' | 'gold';
  table_name: string;
  environment: 'dev' | 'qa' | 'uat' | 'prod';
  source_id: string | null;

  // Schema information
  schema: any; // JSON
  row_count: number;
  file_size: number;
  file_path: string | null;

  // Lineage
  parent_tables: string[] | null; // JSON array

  // Metadata
  description: string | null;
  tags: string[] | null; // JSON array
  owner: string | null;

  created_at: number;
  updated_at: number;

  // Computed fields
  pipeline_name?: string;
  source_name?: string;
  quality_score?: number;
  last_execution?: string;
}

export interface AssetFilters {
  layers?: ('bronze' | 'silver' | 'gold')[];
  environments?: ('dev' | 'qa' | 'uat' | 'prod')[];
  pipelineIds?: string[];
  assetTypes?: string[]; // parquet, csv, delta, etc.
  qualityStatus?: ('healthy' | 'issues' | 'no-rules')[];
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface AssetStats {
  total_assets: number;
  by_layer: {
    bronze: number;
    silver: number;
    gold: number;
  };
  by_environment: {
    dev: number;
    qa: number;
    uat: number;
    prod: number;
  };
  by_quality: {
    healthy: number;
    issues: number;
    no_rules: number;
  };
  total_size: number; // bytes
  total_rows: number;
}

export interface LineageNode {
  id: string;
  table_name: string;
  layer: 'bronze' | 'silver' | 'gold';
  environment: string;
  type: 'source' | 'asset' | 'target';
}

export interface LineageEdge {
  source: string;
  target: string;
  transformation?: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

export class DataAssetsService {
  private db: Database.Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Get paginated list of data assets with filters
   */
  getAssets(filters: AssetFilters = {}) {
    const {
      layers = [],
      environments = ['prod'], // Default to prod only
      pipelineIds = [],
      qualityStatus = [],
      tags = [],
      search = '',
      page = 1,
      limit = 50,
    } = filters;

    const offset = (page - 1) * limit;
    const whereClauses: string[] = [];
    const params: any[] = [];

    // Layer filter
    if (layers.length > 0) {
      whereClauses.push(`mc.layer IN (${layers.map(() => '?').join(', ')})`);
      params.push(...layers);
    }

    // Environment filter
    if (environments.length > 0) {
      whereClauses.push(`mc.environment IN (${environments.map(() => '?').join(', ')})`);
      params.push(...environments);
    }

    // Pipeline filter
    if (pipelineIds.length > 0) {
      whereClauses.push(`p.id IN (${pipelineIds.map(() => '?').join(', ')})`);
      params.push(...pipelineIds);
    }

    // Search filter (table_name or description)
    if (search) {
      whereClauses.push(`(mc.table_name LIKE ? OR mc.description LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
    }

    // Tags filter
    if (tags.length > 0) {
      whereClauses.push(`mc.tags IS NOT NULL`);
      // Note: SQLite JSON filtering is limited, we'll filter in memory
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Main query with source and pipeline joins
    const assetsQuery = `
      SELECT
        mc.*,
        s.name as source_name,
        p.id as pipeline_id,
        p.name as pipeline_name,
        (
          SELECT COUNT(*)
          FROM dq_rules
          WHERE source_id = mc.source_id AND is_active = 1
        ) as total_rules,
        (
          SELECT se.started_at
          FROM source_executions se
          WHERE se.source_id = mc.source_id
          ORDER BY se.started_at DESC
          LIMIT 1
        ) as last_execution
      FROM metadata_catalog mc
      LEFT JOIN sources s ON mc.source_id = s.id
      LEFT JOIN pipelines p ON s.pipeline_id = p.id
      ${whereClause}
      ORDER BY mc.updated_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const assets = this.db.prepare(assetsQuery).all(...params) as any[];

    // Parse JSON fields and calculate quality scores
    const processedAssets = assets.map(asset => {
      const parsed: DataAsset = {
        ...asset,
        schema: asset.schema ? JSON.parse(asset.schema) : [],
        parent_tables: asset.parent_tables ? JSON.parse(asset.parent_tables) : null,
        tags: asset.tags ? JSON.parse(asset.tags) : null,
        quality_score: this.calculateQualityScore(asset.id),
      };
      return parsed;
    });

    // Filter by tags if specified (in-memory)
    let filteredAssets = processedAssets;
    if (tags.length > 0) {
      filteredAssets = processedAssets.filter(asset =>
        asset.tags && asset.tags.some(tag => tags.includes(tag))
      );
    }

    // Filter by quality status if specified
    if (qualityStatus.length > 0) {
      filteredAssets = filteredAssets.filter(asset => {
        const score = asset.quality_score || 0;
        const totalRules = (asset as any).total_rules || 0;

        if (qualityStatus.includes('healthy') && score >= 95 && totalRules > 0) return true;
        if (qualityStatus.includes('issues') && score < 95 && totalRules > 0) return true;
        if (qualityStatus.includes('no-rules') && totalRules === 0) return true;
        return false;
      });
    }

    // Count total (before pagination)
    const countQuery = `
      SELECT COUNT(*) as total
      FROM metadata_catalog mc
      LEFT JOIN sources s ON mc.source_id = s.id
      LEFT JOIN pipelines p ON s.pipeline_id = p.id
      ${whereClause}
    `;

    const countParams = params.slice(0, -2); // Remove limit and offset
    const { total } = this.db.prepare(countQuery).get(...countParams) as { total: number };

    return {
      assets: filteredAssets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Return assets grouped by pipeline and source for Explorer pipeline view.
   */
  getPipelineAssetGroups(filters: AssetFilters = {}) {
    const {
      layers = [],
      environments = ['prod'],
      pipelineIds = [],
      qualityStatus = [],
      tags = [],
      search = '',
    } = filters;

    const whereClauses: string[] = [];
    const params: any[] = [];

    if (layers.length > 0) {
      whereClauses.push(`mc.layer IN (${layers.map(() => '?').join(', ')})`);
      params.push(...layers);
    }

    if (environments.length > 0) {
      whereClauses.push(`mc.environment IN (${environments.map(() => '?').join(', ')})`);
      params.push(...environments);
    }

    if (pipelineIds.length > 0) {
      whereClauses.push(`p.id IN (${pipelineIds.map(() => '?').join(', ')})`);
      params.push(...pipelineIds);
    }

    if (search) {
      const like = `%${search}%`;
      whereClauses.push(`(
        p.name LIKE ?
        OR s.name LIKE ?
        OR mc.table_name LIKE ?
      )`);
      params.push(like, like, like);
    }

    const whereClause = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT
        p.id AS pipeline_id,
        p.name AS pipeline_name,
        p.description AS pipeline_description,
        p.owner AS pipeline_owner,
        p.team AS pipeline_team,
        p.environment AS pipeline_environment,
        p.last_run AS pipeline_last_run,
        s.id AS source_id,
        s.name AS source_name,
        s.type AS source_type,
        s.status AS source_status,
        s.order_index AS source_order_index,
        (
          SELECT se.started_at
          FROM source_executions se
          WHERE se.source_id = s.id
          ORDER BY se.started_at DESC
          LIMIT 1
        ) AS last_source_execution,
        mc.id AS asset_id,
        mc.layer AS asset_layer,
        mc.table_name AS asset_table_name,
        mc.environment AS asset_environment,
        mc.row_count AS asset_row_count,
        mc.file_size AS asset_file_size,
        mc.file_path AS asset_file_path,
        mc.schema AS asset_schema,
        mc.tags AS asset_tags,
        mc.parent_tables AS asset_parent_tables,
        mc.created_at AS asset_created_at,
        mc.updated_at AS asset_updated_at,
        mc.source_id AS asset_source_id,
        (
          SELECT COUNT(*)
          FROM dq_rules
          WHERE source_id = mc.source_id AND is_active = 1
        ) AS total_rules
      FROM metadata_catalog mc
      JOIN sources s ON mc.source_id = s.id
      JOIN pipelines p ON s.pipeline_id = p.id
      ${whereClause}
      ORDER BY p.name, s.order_index, mc.layer
    `;

    const rows = this.db.prepare(query).all(...params) as any[];

    const grouped = new Map<string, any>();

    type QualityStatus = 'healthy' | 'issues' | 'no-rules';
    const determineQualityStatus = (score: number, totalRules: number): QualityStatus => {
      if (totalRules === 0) return 'no-rules';
      return score >= 95 ? 'healthy' : 'issues';
    };

    rows.forEach((row) => {
      const pipelineId = row.pipeline_id;
      const tagsJson = row.asset_tags ? JSON.parse(row.asset_tags) : null;

      if (tags.length > 0) {
        const hasTag = tagsJson && tagsJson.some((tag: string) => tags.includes(tag));
        if (!hasTag) {
          return;
        }
      }

      const qualityScore = this.calculateQualityScore(row.asset_id) || 0;
      const qualityState = determineQualityStatus(qualityScore, row.total_rules || 0);

      if (qualityStatus.length > 0 && !qualityStatus.includes(qualityState)) {
        return;
      }

      if (!grouped.has(pipelineId)) {
        grouped.set(pipelineId, {
          pipelineId,
          pipelineName: row.pipeline_name,
          description: row.pipeline_description,
          owner: row.pipeline_owner,
          team: row.pipeline_team,
          environment: row.pipeline_environment,
          lastRun: row.pipeline_last_run,
          sources: [] as any[],
        });
      }

      const pipelineGroup = grouped.get(pipelineId);

      let sourceGroup = pipelineGroup.sources.find((source: any) => source.sourceId === row.source_id);
      if (!sourceGroup) {
        sourceGroup = {
          sourceId: row.source_id,
          sourceName: row.source_name,
          sourceType: row.source_type,
          sourceStatus: row.source_status,
          orderIndex: row.source_order_index,
          lastExecution: row.last_source_execution,
          datasets: [] as any[],
        };
        pipelineGroup.sources.push(sourceGroup);
      }

      sourceGroup.datasets.push({
        id: row.asset_id,
        layer: row.asset_layer,
        table_name: row.asset_table_name,
        environment: row.asset_environment,
        row_count: row.asset_row_count,
        file_size: row.asset_file_size,
        file_path: row.asset_file_path,
        schema: row.asset_schema ? JSON.parse(row.asset_schema) : [],
        tags: tagsJson,
        parent_tables: row.asset_parent_tables ? JSON.parse(row.asset_parent_tables) : null,
        created_at: row.asset_created_at,
        updated_at: row.asset_updated_at,
        quality_score: qualityScore,
        quality_status: qualityState,
        source_id: row.asset_source_id,
        source_name: row.source_name,
        pipeline_id: pipelineId,
        pipeline_name: row.pipeline_name,
        total_rules: row.total_rules || 0,
      });
    });

    return Array.from(grouped.values()).map((pipeline) => {
      const datasetCount = pipeline.sources.reduce(
        (acc: number, source: any) => acc + source.datasets.length,
        0
      );
      return {
        ...pipeline,
        sourceCount: pipeline.sources.length,
        datasetCount,
      };
    });
  }

  /**
   * Backward-compatible alias for pipeline groups used by the explorer view.
   */
  getWorkflowAssetGroups(filters: AssetFilters = {}) {
    return this.getPipelineAssetGroups(filters);
  }

  /**
   * Get single asset by ID
   */
  getAssetById(id: string): DataAsset | null {
    const query = `
      SELECT
        mc.*,
        s.name as source_name,
        p.id as pipeline_id,
        p.name as pipeline_name,
        (
          SELECT se.started_at
          FROM source_executions se
          WHERE se.source_id = mc.source_id
          ORDER BY se.started_at DESC
          LIMIT 1
        ) as last_execution
      FROM metadata_catalog mc
      LEFT JOIN sources s ON mc.source_id = s.id
      LEFT JOIN pipelines p ON s.pipeline_id = p.id
      WHERE mc.id = ?
    `;

    const asset = this.db.prepare(query).get(id) as any;

    if (!asset) return null;

    return {
      ...asset,
      schema: asset.schema ? JSON.parse(asset.schema) : [],
      parent_tables: asset.parent_tables ? JSON.parse(asset.parent_tables) : null,
      tags: asset.tags ? JSON.parse(asset.tags) : null,
      quality_score: this.calculateQualityScore(id),
    };
  }

  /**
   * Get asset statistics
   */
  getAssetStats(environment: string = 'prod'): AssetStats {
    // Total assets
    const totalQuery = `SELECT COUNT(*) as total FROM metadata_catalog WHERE environment = ?`;
    const { total } = this.db.prepare(totalQuery).get(environment) as { total: number };

    // By layer
    const layerQuery = `
      SELECT layer, COUNT(*) as count
      FROM metadata_catalog
      WHERE environment = ?
      GROUP BY layer
    `;
    const layerResults = this.db.prepare(layerQuery).all(environment) as any[];
    const by_layer = {
      bronze: layerResults.find(r => r.layer === 'bronze')?.count || 0,
      silver: layerResults.find(r => r.layer === 'silver')?.count || 0,
      gold: layerResults.find(r => r.layer === 'gold')?.count || 0,
    };

    // By environment
    const envQuery = `
      SELECT environment, COUNT(*) as count
      FROM metadata_catalog
      GROUP BY environment
    `;
    const envResults = this.db.prepare(envQuery).all() as any[];
    const by_environment = {
      dev: envResults.find(r => r.environment === 'dev')?.count || 0,
      qa: envResults.find(r => r.environment === 'qa')?.count || 0,
      uat: envResults.find(r => r.environment === 'uat')?.count || 0,
      prod: envResults.find(r => r.environment === 'prod')?.count || 0,
    };

    // By quality (simplified - will calculate properly later)
    const by_quality = {
      healthy: 0,
      issues: 0,
      no_rules: 0,
    };

    // Total size and rows
    const aggregateQuery = `
      SELECT
        COALESCE(SUM(file_size), 0) as total_size,
        COALESCE(SUM(row_count), 0) as total_rows
      FROM metadata_catalog
      WHERE environment = ?
    `;
    const aggregate = this.db.prepare(aggregateQuery).get(environment) as any;

    return {
      total_assets: total,
      by_layer,
      by_environment,
      by_quality,
      total_size: aggregate.total_size,
      total_rows: aggregate.total_rows,
    };
  }

  /**
   * Get quality rules for an asset
   */
  getAssetQualityRules(assetId: string) {
    const asset = this.getAssetById(assetId);
    if (!asset || !asset.source_id) {
      return [];
    }

    const query = `
      SELECT *
      FROM dq_rules
      WHERE source_id = ? AND is_active = 1
      ORDER BY severity DESC, rule_type
    `;

    return this.db.prepare(query).all(asset.source_id) as any[];
  }

  /**
   * Get recent source executions for an asset
   */
  getAssetExecutions(assetId: string, limit: number = 10) {
    const asset = this.getAssetById(assetId);
    if (!asset || !asset.source_id) {
      return [];
    }

    const query = `
      SELECT
        se.*,
        e.pipeline_id,
        p.name as pipeline_name,
        s.name as source_name
      FROM source_executions se
      JOIN executions e ON se.execution_id = e.id
      JOIN pipelines p ON e.pipeline_id = p.id
      JOIN sources s ON se.source_id = s.id
      WHERE se.source_id = ?
      ORDER BY se.started_at DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(asset.source_id, limit) as any[];
  }

  /**
   * Get lineage graph for an asset
   */
  getLineageGraph(assetId?: string): LineageGraph {
    const nodes: LineageNode[] = [];
    const edges: LineageEdge[] = [];

    if (assetId) {
      // Get specific asset and its lineage
      const asset = this.getAssetById(assetId);
      if (!asset) {
        return { nodes, edges };
      }

      // Add this asset as center node
      nodes.push({
        id: asset.id,
        table_name: asset.table_name,
        layer: asset.layer,
        environment: asset.environment,
        type: 'asset',
      });

      // Add parent nodes (upstream)
      if (asset.parent_tables && asset.parent_tables.length > 0) {
        asset.parent_tables.forEach(parentName => {
          const parent = this.getAssetByName(parentName, asset.environment);
          if (parent) {
            nodes.push({
              id: parent.id,
              table_name: parent.table_name,
              layer: parent.layer,
              environment: parent.environment,
              type: 'source',
            });
            edges.push({
              source: parent.id,
              target: asset.id,
            });
          }
        });
      }

      // Add child nodes (downstream)
      const children = this.getDownstreamAssets(asset.table_name, asset.environment);
      children.forEach(child => {
        nodes.push({
          id: child.id,
          table_name: child.table_name,
          layer: child.layer,
          environment: child.environment,
          type: 'target',
        });
        edges.push({
          source: asset.id,
          target: child.id,
        });
      });
    } else {
      // Get all assets for full lineage graph
      const allAssets = this.db.prepare(
        'SELECT * FROM metadata_catalog WHERE environment = ?'
      ).all('prod') as any[];

      allAssets.forEach(asset => {
        nodes.push({
          id: asset.id,
          table_name: asset.table_name,
          layer: asset.layer,
          environment: asset.environment,
          type: 'asset',
        });

        const parentTables = asset.parent_tables ? JSON.parse(asset.parent_tables) : [];
        parentTables.forEach((parentName: string) => {
          const parent = allAssets.find(a => a.table_name === parentName);
          if (parent) {
            edges.push({
              source: parent.id,
              target: asset.id,
            });
          }
        });
      });
    }

    return { nodes, edges };
  }

  /**
   * Update asset metadata
   */
  updateAsset(id: string, updates: Partial<Pick<DataAsset, 'description' | 'tags' | 'owner'>>) {
    const updateFields: string[] = [];
    const params: any[] = [];

    if (updates.description !== undefined) {
      updateFields.push('description = ?');
      params.push(updates.description);
    }

    if (updates.tags !== undefined) {
      updateFields.push('tags = ?');
      params.push(JSON.stringify(updates.tags));
    }

    if (updates.owner !== undefined) {
      updateFields.push('owner = ?');
      params.push(updates.owner);
    }

    if (updateFields.length === 0) {
      return;
    }

    updateFields.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    const query = `
      UPDATE metadata_catalog
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    this.db.prepare(query).run(...params);
  }

  /**
   * Get all pipelines for filter dropdown
   */
  getPipelines() {
    const query = `
      SELECT DISTINCT p.id, p.name
      FROM pipelines p
      JOIN sources s ON p.id = s.pipeline_id
      JOIN metadata_catalog mc ON s.id = mc.source_id
      ORDER BY p.name
    `;

    return this.db.prepare(query).all() as { id: string; name: string }[];
  }

  /**
   * Backward-compatible alias for pipeline dropdowns
   */
  getWorkflows() {
    return this.getPipelines();
  }

  /**
   * Private helper: Calculate quality score for an asset
   */
  private calculateQualityScore(assetId: string): number {
    const asset = this.db.prepare('SELECT source_id FROM metadata_catalog WHERE id = ?').get(assetId) as any;

    if (!asset || !asset.source_id) {
      return 0;
    }

    // Get all active rules
    const totalRules = this.db.prepare(
      'SELECT COUNT(*) as count FROM dq_rules WHERE source_id = ? AND is_active = 1'
    ).get(asset.source_id) as any;

    if (totalRules.count === 0) {
      return 0; // No rules = no score
    }

    // For now, return mock score (TODO: implement actual validation checks)
    return 95 + Math.random() * 5; // 95-100%
  }

  /**
   * Private helper: Get asset by table name
   */
  private getAssetByName(tableName: string, environment: string): DataAsset | null {
    const query = `
      SELECT * FROM metadata_catalog
      WHERE table_name = ? AND environment = ?
    `;

    const asset = this.db.prepare(query).get(tableName, environment) as any;

    if (!asset) return null;

    return {
      ...asset,
      schema: asset.schema ? JSON.parse(asset.schema) : [],
      parent_tables: asset.parent_tables ? JSON.parse(asset.parent_tables) : null,
      tags: asset.tags ? JSON.parse(asset.tags) : null,
    };
  }

  /**
   * Private helper: Get downstream assets
   */
  private getDownstreamAssets(tableName: string, environment: string): DataAsset[] {
    const query = `
      SELECT * FROM metadata_catalog
      WHERE parent_tables LIKE ? AND environment = ?
    `;

    const assets = this.db.prepare(query).all(`%${tableName}%`, environment) as any[];

    return assets
      .map(asset => ({
        ...asset,
        schema: asset.schema ? JSON.parse(asset.schema) : [],
        parent_tables: asset.parent_tables ? JSON.parse(asset.parent_tables) : null,
        tags: asset.tags ? JSON.parse(asset.tags) : null,
      }))
      .filter(asset => asset.parent_tables && asset.parent_tables.includes(tableName));
  }

  // Note: Database is shared, no need to close
}
