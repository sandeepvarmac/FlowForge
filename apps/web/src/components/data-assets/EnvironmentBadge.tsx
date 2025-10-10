/**
 * Environment Badge Component
 * Displays environment (Dev/QA/UAT/Prod) with color coding
 */

import React from 'react';

interface EnvironmentBadgeProps {
  environment: 'dev' | 'qa' | 'uat' | 'prod';
  size?: 'sm' | 'md';
  className?: string;
}

export function EnvironmentBadge({ environment, size = 'sm', className = '' }: EnvironmentBadgeProps) {
  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
  };

  const envConfig = {
    dev: {
      label: 'DEV',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      border: 'border-purple-200',
    },
    qa: {
      label: 'QA',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
    },
    uat: {
      label: 'UAT',
      bg: 'bg-yellow-50',
      text: 'text-yellow-700',
      border: 'border-yellow-200',
    },
    prod: {
      label: 'PROD',
      bg: 'bg-green-50',
      text: 'text-green-700',
      border: 'border-green-200',
    },
  };

  const config = envConfig[environment];

  return (
    <span
      className={`
        inline-flex items-center font-semibold rounded border
        ${config.bg} ${config.text} ${config.border}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {config.label}
    </span>
  );
}
