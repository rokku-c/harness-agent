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

/**
 * The value `JSON.stringify` would visit next: a `toJSON` method is applied
 * first, and then the result visited the same way.
 */
const encodedOf = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value
  const method = (value as { toJSON?: unknown }).toJSON
  return typeof method !== "function" ? value : encodedOf((method as (this: unknown) => unknown).call(value))
}

/**
 * Recursively sort object keys so structurally equal data stringifies alike.
 *
 * Sorting is the whole of what this may do. A value carrying its own `toJSON` —
 * a `Date` above all — has no own keys to sort, so reading it as a record
 * canonicalizes it to `{}`: the encoding an empty object gets, and the encoding
 * every other date gets, so two frames that differ only in a date hash alike and
 * a hash that reads "unchanged" is a change the observer never reports. It is
 * visited through `toJSON` first, which is what the store's own `JSON.stringify`
 * does when it writes the frame.
 */
const sortKeys = (value: unknown): unknown => {
  const encoded = encodedOf(value)
  if (Array.isArray(encoded)) return encoded.map(sortKeys)
  if (encoded === null || typeof encoded !== "object") return encoded
  const source = encoded as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    const inner = source[key]
    if (inner !== undefined) out[key] = sortKeys(inner)
  }
  return out
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
