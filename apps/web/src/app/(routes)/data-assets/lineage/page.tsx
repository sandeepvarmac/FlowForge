'use client';

/**
 * Data Assets Lineage Page
 * Full interactive lineage graph visualization (Phase 2)
 */

import React from 'react';
import { GitBranch, Search, Layers } from 'lucide-react';

export default function DataLineagePage() {
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Lineage</h1>
            <p className="text-sm text-gray-600 mt-1">
              Visualize data flow across your medallion architecture
            </p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Environment:</label>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
                <option value="prod">Production</option>
                <option value="uat">UAT</option>
                <option value="qa">QA</option>
                <option value="dev">Development</option>
              </select>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search asset..."
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Coming Soon Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-6 bg-primary-100 rounded-full flex items-center justify-center">
            <GitBranch className="w-12 h-12 text-primary-600" />
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Interactive Lineage Graph
          </h2>

          <p className="text-gray-600 mb-6">
            Coming in Phase 2 - Full interactive lineage visualization with node exploration, impact analysis, and transformation details.
          </p>

          <div className="bg-primary-50 rounded-lg p-6 text-left">
            <h3 className="font-semibold text-primary-900 mb-3 flex items-center gap-2">
              <Layers className="w-5 h-5" />
              Planned Features
            </h3>
            <ul className="space-y-2 text-sm text-primary-700">
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Interactive graph with drag-and-drop nodes</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Auto-layout by medallion layer (Bronze → Silver → Gold)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Click nodes to view transformation logic</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Impact analysis: "What breaks if I change this?"</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Column-level lineage tracking</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-500 mt-0.5">•</span>
                <span>Export lineage diagram as PNG/SVG</span>
              </li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            For now, view lineage in the Explorer tab of each asset
          </p>
        </div>
      </div>
    </div>
  );
}
