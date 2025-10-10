/**
 * Quality Indicator Component
 * Displays quality score with visual indicator (✓/⚠/✗)
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface QualityIndicatorProps {
  score: number; // 0-100
  totalRules?: number;
  showPercentage?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function QualityIndicator({
  score,
  totalRules = 0,
  showPercentage = true,
  size = 'md',
  className = '',
}: QualityIndicatorProps) {
  const sizeConfig = {
    sm: { icon: 'w-3 h-3', text: 'text-xs' },
    md: { icon: 'w-4 h-4', text: 'text-sm' },
    lg: { icon: 'w-5 h-5', text: 'text-base' },
  };

  const sizes = sizeConfig[size];

  // No rules = no quality score
  if (totalRules === 0) {
    return (
      <span className={`inline-flex items-center gap-1 text-gray-400 ${sizes.text} ${className}`}>
        <span className="text-gray-400">—</span>
        {showPercentage && <span>No rules</span>}
      </span>
    );
  }

  // Determine quality level
  let Icon = CheckCircle;
  let colorClass = 'text-green-600';
  let bgClass = 'bg-green-50';

  if (score < 80) {
    Icon = XCircle;
    colorClass = 'text-red-600';
    bgClass = 'bg-red-50';
  } else if (score < 95) {
    Icon = AlertTriangle;
    colorClass = 'text-yellow-600';
    bgClass = 'bg-yellow-50';
  }

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-md
        ${bgClass} ${colorClass} ${sizes.text} ${className}
      `}
    >
      <Icon className={sizes.icon} />
      {showPercentage && (
        <span className="font-medium">
          {score.toFixed(0)}%
        </span>
      )}
    </span>
  );
}
