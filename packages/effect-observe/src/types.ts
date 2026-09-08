/**
 * Monitoring primitives: perspectives, samplers, timestamped frames and the
 * stable JSON hash used to detect when an observed world state changes.
 */

/** The three viewpoints a frame can be sampled from. */
export type Perspective = "app" | "agent" | "global"

/**
 * Returns a serializable observation of one perspective+target.
 * The store never samples; callers supply samplers that know how to read
 * e.g. an effect-app's ui doc + state + config (agent), live app state (app),
 * or a mesh/registry snapshot (global).
 */
export type Sampler = (perspective: Perspective, target: string) => unknown | Promise<unknown>

/** A timestamped observation frame for one perspective+target. */
export interface ObservationSnapshot {
  at: number
  perspective: Perspective
  target: string
  data: unknown
}

/** Recursively sort object keys so structurally equal data stringifies alike. */
const sortKeys = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      const inner = (value as Record<string, unknown>)[key]!
      if (inner !== undefined) out[key] = sortKeys(inner)
    }
    return out
  }
  return value
}

/** FNV-1a over stable JSON; the default change-detection hash. */
export const jsonHash = (value: unknown): string => {
  const json = JSON.stringify(sortKeys(value)) ?? "null"
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}
