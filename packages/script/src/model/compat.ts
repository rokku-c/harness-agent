/**
 * model/compat.ts - the COMPATIBILITY POLICY.
 *
 * Moved to @effect-agent/effect-compat so every upgradeable artifact (script
 * tools, kernel, apps) adjudicates with the SAME model instead of one per kind.
 * Re-exported here to keep the script package's surface unchanged.
 */
export type { CompatLevel, CompatMode, CompatPolicy } from "@effect-agent/effect-compat"
export { defaultCompat } from "@effect-agent/effect-compat"
