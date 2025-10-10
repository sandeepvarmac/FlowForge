/**
 * Data Assets Service
 * Business logic for data catalog and asset management
 */

import Database from 'better-sqlite3';
import { DB_PATH } from '@/lib/db';

export interface DataAsset {
  id: string;
  layer: 'bronze' | 'silver' | 'gold';
  table_name: string;
  environment: 'dev' | 'qa' | 'uat' | 'prod';
  job_id: string | null;

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
  workflow_name?: string;
  job_name?: string;
  quality_score?: number;
  last_execution?: string;
}

export interface AssetFilters {
  layers?: ('bronze' | 'silver' | 'gold')[];
  environments?: ('dev' | 'qa' | 'uat' | 'prod')[];
  workflowIds?: string[];
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

  constructor(dbPath: string = DB_PATH) {
    this.db = new Database(dbPath);
  }

  /**
   * Get paginated list of data assets with filters
   */
  getAssets(filters: AssetFilters = {}) {
    const {
      layers = [],
      environments = ['prod'], // Default to prod only
      workflowIds = [],
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

    // Workflow filter
    if (workflowIds.length > 0) {
      whereClauses.push(`w.id IN (${workflowIds.map(() => '?').join(', ')})`);
      params.push(...workflowIds);
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

    // Main query with job and workflow joins
    const assetsQuery = `
      SELECT
        mc.*,
        j.name as job_name,
        w.id as workflow_id,
        w.name as workflow_name,
        (
          SELECT COUNT(*)
          FROM dq_rules
          WHERE job_id = mc.job_id AND is_active = 1
        ) as total_rules,
        (
          SELECT je.started_at
          FROM job_executions je
          WHERE je.job_id = mc.job_id
          ORDER BY je.started_at DESC
          LIMIT 1
        ) as last_execution
      FROM metadata_catalog mc
      LEFT JOIN jobs j ON mc.job_id = j.id
      LEFT JOIN workflows w ON j.workflow_id = w.id
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
      LEFT JOIN jobs j ON mc.job_id = j.id
      LEFT JOIN workflows w ON j.workflow_id = w.id
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
   * Get single asset by ID
   */
  getAssetById(id: string): DataAsset | null {
    const query = `
      SELECT
        mc.*,
        j.name as job_name,
        w.id as workflow_id,
        w.name as workflow_name,
        (
          SELECT je.started_at
          FROM job_executions je
          WHERE je.job_id = mc.job_id
          ORDER BY je.started_at DESC
          LIMIT 1
        ) as last_execution
      FROM metadata_catalog mc
      LEFT JOIN jobs j ON mc.job_id = j.id
      LEFT JOIN workflows w ON j.workflow_id = w.id
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
    if (!asset || !asset.job_id) {
      return [];
    }

    const query = `
      SELECT *
      FROM dq_rules
      WHERE job_id = ? AND is_active = 1
      ORDER BY severity DESC, rule_type
    `;

    return this.db.prepare(query).all(asset.job_id) as any[];
  }

  /**
   * Get recent job executions for an asset
   */
  getAssetExecutions(assetId: string, limit: number = 10) {
    const asset = this.getAssetById(assetId);
    if (!asset || !asset.job_id) {
      return [];
    }

    const query = `
      SELECT
        je.*,
        e.workflow_id,
        w.name as workflow_name,
        j.name as job_name
      FROM job_executions je
      JOIN executions e ON je.execution_id = e.id
      JOIN workflows w ON e.workflow_id = w.id
      JOIN jobs j ON je.job_id = j.id
      WHERE je.job_id = ?
      ORDER BY je.started_at DESC
      LIMIT ?
    `;

    return this.db.prepare(query).all(asset.job_id, limit) as any[];
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
   * Get all workflows for filter dropdown
   */
  getWorkflows() {
    const query = `
      SELECT DISTINCT w.id, w.name
      FROM workflows w
      JOIN jobs j ON w.id = j.workflow_id
      JOIN metadata_catalog mc ON j.id = mc.job_id
      ORDER BY w.name
    `;

    return this.db.prepare(query).all() as { id: string; name: string }[];
  }

  /**
   * Private helper: Calculate quality score for an asset
   */
  private calculateQualityScore(assetId: string): number {
    const asset = this.db.prepare('SELECT job_id FROM metadata_catalog WHERE id = ?').get(assetId) as any;

    if (!asset || !asset.job_id) {
      return 0;
    }

    // Get all active rules
    const totalRules = this.db.prepare(
      'SELECT COUNT(*) as count FROM dq_rules WHERE job_id = ? AND is_active = 1'
    ).get(asset.job_id) as any;

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

  close() {
    this.db.close();
  }
}
