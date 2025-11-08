"use client"

/**
 * Data Assets Lineage Page
 * Full interactive lineage graph visualization (Phase 2)
 */

import { Card, CardContent, Badge } from '@/components/ui'
import { GitBranch, Layers, Network, Search, Workflow, GitMerge, ArrowRightLeft, Database } from 'lucide-react'

export default function DataLineagePage() {
  const features = [
    { title: 'Interactive Graph Visualization', description: 'Drag-and-drop nodes with zoom, pan, and auto-layout capabilities', icon: Network },
    { title: 'Medallion Layer Mapping', description: 'Automatic layout by Bronze → Silver → Gold architecture', icon: Layers },
    { title: 'Transformation Details', description: 'Click nodes to view transformation logic and business rules', icon: Workflow },
    { title: 'Impact Analysis', description: 'Analyze downstream effects: "What breaks if I change this?"', icon: GitMerge },
    { title: 'Column-Level Lineage', description: 'Track individual column transformations across pipeline stages', icon: ArrowRightLeft },
    { title: 'Cross-Workflow Tracking', description: 'Visualize dependencies between workflows and data assets', icon: GitBranch },
    { title: 'Source-to-Target Paths', description: 'Trace data from source systems to final analytics tables', icon: Database },
    { title: 'Export & Share', description: 'Export lineage diagrams as PNG, SVG, or interactive HTML', icon: Search }
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Data Lineage</h1>
        <p className="text-foreground-muted mt-1">
          Visualize data flow and transformations across your medallion architecture
        </p>
      </div>

      {/* Hero Card */}
      <Card className="border-2 border-dashed border-gray-300 bg-gradient-to-br from-purple-50 to-pink-50">
        <CardContent className="p-12 text-center">
          <GitBranch className="w-20 h-20 mx-auto mb-6 text-purple-600" />
          <h2 className="text-2xl font-bold text-foreground mb-3">Data Lineage</h2>
          <p className="text-lg text-foreground-muted max-w-2xl mx-auto mb-6">
            Full interactive lineage visualization with node exploration, impact analysis, and transformation details
          </p>
          <Badge variant="default" className="text-sm px-4 py-2">Coming in Phase 2</Badge>
        </CardContent>
      </Card>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {features.map((feature, index) => (
          <Card key={index} className="border-dashed border-2">
            <CardContent className="p-6">
              <div className="p-3 rounded-lg bg-purple-50 w-fit mb-4">
                <feature.icon className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-foreground-muted">{feature.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Additional Info */}
      <Card className="bg-gray-50">
        <CardContent className="p-6">
          <p className="text-sm text-foreground-muted text-center">
            💡 <strong>Note:</strong> For now, view lineage in the <span className="font-semibold">Lineage tab</span> within the Data Assets Explorer for each individual asset
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
