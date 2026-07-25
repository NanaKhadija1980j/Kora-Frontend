/**
 * Feature Flags — Issue #308
 *
 * Centralised, type-safe feature flag system backed by env vars.
 * All flags default to `false` in production. Set to `"true"` in
 * `.env.local` to enable a flag during development.
 *
 * Usage:
 *   import { isEnabled } from "@/lib/featureFlags";
 *   if (isEnabled("comparison")) { ... }
 */

/**
 * Every feature flag supported by the app. Add new flags here.
 *
 * | Flag              | Env var                               | Description                                    |
 * |-------------------|---------------------------------------|------------------------------------------------|
 * | mock-data         | NEXT_PUBLIC_ENABLE_MOCK_DATA           | Use mock data (no live Soroban)                |
 * | devtools          | NEXT_PUBLIC_ENABLE_DEVTOOLS            | Show React Query devtools                      |
 * | comparison        | NEXT_PUBLIC_ENABLE_COMPARISON          | Invoice comparison bar in marketplace          |
 * | onboarding-tour   | NEXT_PUBLIC_ENABLE_ONBOARDING_TOUR     | Guided onboarding tour for new users           |
 * | batch-actions     | NEXT_PUBLIC_ENABLE_BATCH_ACTIONS       | Batch cancel/repay in SME dashboard            |
 */
export type FeatureFlag =
  | "mock-data"
  | "devtools"
  | "comparison"
  | "onboarding-tour"
  | "batch-actions";

/** Maps each flag to its NEXT_PUBLIC_* env var name. */
const FLAG_ENV_MAP: Record<FeatureFlag, string> = {
  "mock-data": "NEXT_PUBLIC_ENABLE_MOCK_DATA",
  devtools: "NEXT_PUBLIC_ENABLE_DEVTOOLS",
  comparison: "NEXT_PUBLIC_ENABLE_COMPARISON",
  "onboarding-tour": "NEXT_PUBLIC_ENABLE_ONBOARDING_TOUR",
  "batch-actions": "NEXT_PUBLIC_ENABLE_BATCH_ACTIONS",
};

/**
 * Returns `true` if the given feature flag is enabled.
 *
 * Reads the corresponding NEXT_PUBLIC_* env var at runtime.
 * Only the string `"true"` (case-sensitive) enables a flag.
 */
export function isEnabled(flag: FeatureFlag): boolean {
  const envVar = FLAG_ENV_MAP[flag];
  return process.env[envVar] === "true";
}
