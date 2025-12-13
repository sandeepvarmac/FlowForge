/**
 * Feature Flags Configuration
 *
 * Centralized feature flag management for FlowForge.
 * Flags can be controlled via environment variables or defaults.
 *
 * Usage:
 *   import { featureFlags } from '@/lib/config/feature-flags'
 *   if (featureFlags.showComingSoon) { ... }
 *
 * Or with React hook:
 *   import { useFeatureFlags } from '@/lib/config/feature-flags'
 *   const { showComingSoon } = useFeatureFlags()
 */

export interface FeatureFlags {
  // UI Feature Flags
  showComingSoon: boolean           // Show "Coming Soon" cards in UI
  showBetaFeatures: boolean         // Show beta/experimental features

  // Source Creation Modal Flags
  showPartitioningConfig: boolean   // Show Partitioning configuration (Coming Soon)
  showSchemaEvolution: boolean      // Show Schema Evolution configuration (Coming Soon)
  showCDCOption: boolean            // Show CDC option in Load Strategy (Coming Soon)
  showStreamingSource: boolean      // Show Streaming source type (Coming Soon)
  showAPISource: boolean            // Show API source type (Coming Soon)
  showNoSQLSource: boolean          // Show NoSQL source type (Coming Soon)
  showSilverComingSoon: boolean     // Show Silver layer Coming Soon cards (PII, Performance, etc.)
  showGoldComingSoon: boolean       // Show Gold layer Coming Soon cards (Aggregation, Denormalization, etc.)

  // Advanced Features
  showGoldAnalytics: boolean        // Show Gold Analytics source type
  showReconciliation: boolean       // Show Reconciliation rules
  showDataLineage: boolean          // Show Data Lineage visualization

  // Demo Mode
  demoMode: boolean                 // Enable demo-optimized UI (hides all Coming Soon)
}

/**
 * Parse boolean from environment variable
 */
function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === '') return defaultValue
  return value.toLowerCase() === 'true' || value === '1'
}

/**
 * Get feature flags from environment variables with defaults
 */
function getFeatureFlags(): FeatureFlags {
  // Check if demo mode is enabled - if so, hide all "Coming Soon" features
  const demoMode = parseBool(process.env.NEXT_PUBLIC_DEMO_MODE, false)

  // Base "show coming soon" flag
  const showComingSoon = demoMode
    ? false
    : parseBool(process.env.NEXT_PUBLIC_SHOW_COMING_SOON, true)

  return {
    // UI Feature Flags
    showComingSoon,
    showBetaFeatures: parseBool(process.env.NEXT_PUBLIC_SHOW_BETA_FEATURES, false),

    // Source Creation Modal - inherit from showComingSoon unless explicitly set
    showPartitioningConfig: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_PARTITIONING, showComingSoon),
    showSchemaEvolution: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_SCHEMA_EVOLUTION, showComingSoon),
    showCDCOption: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_CDC_OPTION, showComingSoon),
    showStreamingSource: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_STREAMING_SOURCE, showComingSoon),
    showAPISource: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_API_SOURCE, showComingSoon),
    showNoSQLSource: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_NOSQL_SOURCE, showComingSoon),
    showSilverComingSoon: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_SILVER_COMING_SOON, false), // Default hidden for cleaner demo
    showGoldComingSoon: demoMode
      ? false
      : parseBool(process.env.NEXT_PUBLIC_SHOW_GOLD_COMING_SOON, false), // Default hidden for cleaner demo

    // Advanced Features - these are implemented, so default to true
    showGoldAnalytics: parseBool(process.env.NEXT_PUBLIC_SHOW_GOLD_ANALYTICS, true),
    showReconciliation: parseBool(process.env.NEXT_PUBLIC_SHOW_RECONCILIATION, true),
    showDataLineage: parseBool(process.env.NEXT_PUBLIC_SHOW_DATA_LINEAGE, true),

    // Demo Mode
    demoMode,
  }
}

/**
 * Singleton feature flags instance
 * Use this for non-React contexts (API routes, utilities, etc.)
 */
export const featureFlags: FeatureFlags = getFeatureFlags()

/**
 * React hook for feature flags
 * Use this in React components for consistent access
 */
export function useFeatureFlags(): FeatureFlags {
  // In a more complex setup, this could use React context
  // For now, return the singleton since env vars don't change at runtime
  return featureFlags
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return featureFlags[flag]
}
