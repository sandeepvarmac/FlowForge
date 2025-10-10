/**
 * Asset Card Component
 * Displays asset summary in list view
 */

import React from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Database, Clock, HardDrive } from 'lucide-react';
import { LayerBadge } from './LayerBadge';
import { EnvironmentBadge } from './EnvironmentBadge';
import { QualityIndicator } from './QualityIndicator';

interface AssetCardProps {
  asset: {
    id: string;
    table_name: string;
    layer: 'bronze' | 'silver' | 'gold';
    environment: 'dev' | 'qa' | 'uat' | 'prod';
    row_count: number;
    file_size: number;
    updated_at: number;
    quality_score?: number;
    total_rules?: number;
  };
  isSelected?: boolean;
  onClick?: () => void;
}

export function AssetCard({ asset, isSelected = false, onClick }: AssetCardProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const lastUpdated = formatDistanceToNow(new Date(asset.updated_at), { addSuffix: true });

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-lg border transition-all
        hover:border-primary-300 hover:bg-primary-50/50
        ${isSelected ? 'border-primary-500 bg-primary-50 shadow-sm' : 'border-gray-200 bg-white'}
      `}
    >
      {/* Asset Name */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Database className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <h3 className="font-semibold text-gray-900 truncate">
            {asset.table_name}
          </h3>
        </div>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <LayerBadge layer={asset.layer} size="sm" />
        <EnvironmentBadge environment={asset.environment} size="sm" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3" />
          <span>{formatCount(asset.row_count)} rows</span>
        </div>
        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3" />
          <span>{formatBytes(asset.file_size)}</span>
        </div>
      </div>

      {/* Quality & Last Updated */}
      <div className="flex items-center justify-between gap-2">
        <QualityIndicator
          score={asset.quality_score || 0}
          totalRules={asset.total_rules || 0}
          size="sm"
        />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Clock className="w-3 h-3" />
          <span>{lastUpdated}</span>
        </div>
      </div>
    </button>
  );
}
