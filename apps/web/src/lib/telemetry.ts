/**
 * AI Telemetry Helper
 *
 * Tracks AI usage for analytics and diagnostics.
 * Currently logs to console. Future: Send to analytics service (Posthog, Mixpanel, etc.)
 */

export interface AITelemetryEvent {
  event: string
  metadata: Record<string, any>
  timestamp: string
}

class AITelemetry {
  private events: AITelemetryEvent[] = []

  /**
   * Track an AI-related event
   */
  track(event: string, metadata: Record<string, any> = {}) {
    const telemetryEvent: AITelemetryEvent = {
      event,
      metadata,
      timestamp: new Date().toISOString()
    }

    // Store event for potential batch sending
    this.events.push(telemetryEvent)

    // Keep only last 100 events in memory
    if (this.events.length > 100) {
      this.events.shift()
    }

    // Log to console for now
    console.log(`[AI Telemetry] ${event}`, metadata)

    // Future: Send to analytics service
    // this.sendToAnalytics(telemetryEvent)
  }

  /**
   * Track AI suggestions fetched
   */
  trackSuggestionsFetched(params: {
    layer: 'bronze' | 'silver' | 'gold'
    tableName: string
    suggestionsCount: number
    overallConfidence?: number
    usingFallback?: boolean
    duration?: number
  }) {
    this.track('ai_suggestions_fetched', params)
  }

  /**
   * Track AI suggestions applied
   */
  trackSuggestionsApplied(params: {
    layer: 'bronze' | 'silver' | 'gold'
    suggestionsAccepted: number
    suggestionsTotal: number
    timeToApplyMs?: number
  }) {
    this.track('ai_suggestions_applied', params)
  }

  /**
   * Track AI error
   */
  trackError(params: {
    layer: 'bronze' | 'silver' | 'gold'
    errorMessage: string
    fallbackUsed?: boolean
  }) {
    this.track('ai_error', params)
  }

  /**
   * Track suggestion expansion (user reviewing details)
   */
  trackSuggestionExpanded(params: {
    layer: 'bronze' | 'silver' | 'gold'
    expanded: boolean
  }) {
    this.track('ai_suggestion_expanded', params)
  }

  /**
   * Get all tracked events
   */
  getEvents(): AITelemetryEvent[] {
    return [...this.events]
  }

  /**
   * Clear all tracked events
   */
  clearEvents() {
    this.events = []
  }

  /**
   * Future: Send events to analytics service
   */
  private sendToAnalytics(event: AITelemetryEvent) {
    // Example implementation for Posthog:
    // if (typeof window !== 'undefined' && (window as any).posthog) {
    //   (window as any).posthog.capture(event.event, event.metadata)
    // }

    // Example implementation for Mixpanel:
    // if (typeof window !== 'undefined' && (window as any).mixpanel) {
    //   (window as any).mixpanel.track(event.event, event.metadata)
    // }
  }
}

// Export singleton instance
export const aiTelemetry = new AITelemetry()

// Export helper functions for common tracking patterns
export const trackAISuggestionsFetched = aiTelemetry.trackSuggestionsFetched.bind(aiTelemetry)
export const trackAISuggestionsApplied = aiTelemetry.trackSuggestionsApplied.bind(aiTelemetry)
export const trackAIError = aiTelemetry.trackError.bind(aiTelemetry)
export const trackAISuggestionExpanded = aiTelemetry.trackSuggestionExpanded.bind(aiTelemetry)
