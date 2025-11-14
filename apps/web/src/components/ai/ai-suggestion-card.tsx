"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { Badge, Button } from "@/components/ui"
import { Sparkles, ChevronDown, ChevronUp, Lightbulb, Loader2 } from "lucide-react"

export interface AISuggestion {
  enabled: boolean
  confidence: number
  reasoning: string
  [key: string]: any
}

export interface AISuggestionCardProps {
  title: string
  description?: string
  suggestions: Record<string, AISuggestion>
  loading?: boolean
  error?: string | null
  onAccept?: () => void
  onAdjust?: () => void
  isExpanded?: boolean
  onToggleExpand?: () => void
}

export function AISuggestionCard({
  title,
  description,
  suggestions,
  loading = false,
  error = null,
  onAccept,
  onAdjust,
  isExpanded = false,
  onToggleExpand
}: AISuggestionCardProps) {
  const [localExpanded, setLocalExpanded] = React.useState(isExpanded)

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand()
    } else {
      setLocalExpanded(!localExpanded)
    }
  }

  const expanded = onToggleExpand ? isExpanded : localExpanded

  // Calculate overall confidence
  const confidenceScores = Object.values(suggestions)
    .filter((s) => s.enabled)
    .map((s) => s.confidence)
  const overallConfidence =
    confidenceScores.length > 0
      ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
      : 0

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
          {confidence}% ✓ High
        </Badge>
      )
    } else if (confidence >= 70) {
      return (
        <Badge variant="default" className="bg-blue-100 text-blue-700 border-blue-200">
          {confidence}% ℹ Medium
        </Badge>
      )
    } else {
      return (
        <Badge variant="default" className="bg-yellow-100 text-yellow-700 border-yellow-200">
          {confidence}% ⚠ Low
        </Badge>
      )
    }
  }

  if (loading) {
    return (
      <Card className="border-2 border-blue-200 bg-blue-50/30">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-3" />
          <span className="text-blue-900">AI is analyzing your data...</span>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-2 border-red-200 bg-red-50/30">
        <CardContent className="p-6">
          <p className="text-red-900 font-medium">⚠ AI Analysis Failed</p>
          <p className="text-red-700 text-sm mt-2">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-r from-blue-50/50 to-purple-50/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-600" />
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getConfidenceBadge(overallConfidence)}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleExpand}
              className="text-purple-600 hover:text-purple-700 hover:bg-purple-100"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Collapse
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Review
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary view (collapsed) */}
        {!expanded && (
          <div className="space-y-2">
            {Object.entries(suggestions).map(([key, suggestion]) => (
              suggestion.enabled && (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="text-green-600 font-bold">✓</span>
                  <span className="font-medium capitalize">
                    {key.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-muted-foreground">
                    {typeof suggestion === 'object' && Object.keys(suggestion).length > 3
                      ? 'Configured'
                      : 'Enabled'}
                  </span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Detailed view (expanded) */}
        {expanded && (
          <div className="space-y-4">
            {Object.entries(suggestions).map(([key, suggestion]) => (
              <div
                key={key}
                className={`p-4 rounded-lg border ${
                  suggestion.enabled
                    ? 'bg-white border-purple-200'
                    : 'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={suggestion.enabled ? 'text-green-600' : 'text-gray-400'}>
                      {suggestion.enabled ? '✓' : '○'}
                    </span>
                    <h4 className="font-semibold capitalize">{key.replace(/_/g, ' ')}</h4>
                  </div>
                  {getConfidenceBadge(suggestion.confidence)}
                </div>

                {/* Show configuration details */}
                <div className="space-y-1 text-sm mb-3">
                  {Object.entries(suggestion)
                    .filter(([k, v]) => !['confidence', 'reasoning', 'enabled'].includes(k) && v !== null && v !== undefined)
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}:</span>
                        <span className="font-medium">
                          {typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}
                        </span>
                      </div>
                    ))}
                </div>

                {/* AI Reasoning */}
                {suggestion.reasoning && (
                  <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-md">
                    <Lightbulb className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-900">{suggestion.reasoning}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 pt-3 border-t">
          <Button
            onClick={onAccept}
            disabled={!onAccept}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Accept & Apply
          </Button>
          <Button
            onClick={onAdjust}
            disabled={!onAdjust}
            variant="outline"
            className="flex-1 border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {expanded ? '✕ Close Details' : '⚙ Review & Adjust'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
