/**
 * Layer Badge Component
 * Displays medallion layer (Bronze/Silver/Gold) with brand colors
 */

import React from 'react';

interface LayerBadgeProps {
  layer: 'bronze' | 'silver' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LayerBadge({ layer, size = 'md', className = '' }: LayerBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  };

  const layerConfig = {
    bronze: {
      label: 'Bronze',
      bg: 'bg-accent-orange/10',
      text: 'text-accent-orange',
      border: 'border-accent-orange/30',
    },
    silver: {
      label: 'Silver',
      bg: 'bg-primary-50',
      text: 'text-primary-700',
      border: 'border-primary-300',
    },
    gold: {
      label: 'Gold',
      bg: 'bg-gradient-to-r from-primary-600 to-secondary-500',
      text: 'text-white',
      border: 'border-transparent',
    },
  };

  const config = layerConfig[layer];

  return (
    <span
      className={`
        inline-flex items-center font-medium rounded-md border
        ${config.bg} ${config.text} ${config.border}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {config.label}
    </span>
  );
}
