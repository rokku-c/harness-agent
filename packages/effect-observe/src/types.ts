/**
 * Monitoring primitives: perspectives, samplers, timestamped frames and the
 * stable JSON hash used to detect when an observed world state changes.
 */
import { stableString } from "@effect-agent/canonical-json"

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

/**
 * FNV-1a over the canonical JSON; the default change-detection hash.
 *
 * The encoding is `@effect-agent/canonical-json`'s, which is also what the store
 * writes, so the hash and the recorded frame are the same data.
 */
export const jsonHash = (value: unknown): string => {
  const json = stableString(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16)
}
