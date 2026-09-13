/**
 * Key-order-independent structural equality.
 *
 * Two code paths can describe the same artifact with their keys in a different
 * order — `artifactOf` emits `kind` before `abi`, while the validator rebuilds
 * the object the other way round. `JSON.stringify` calls those different, so a
 * naive diff reports a phantom "update" every time a node is re-pushed, which is
 * precisely the noise that trains people to stop reading diffs.
 */

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical)
  if (typeof value !== "object" || value === null) return value
  const source = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (source[key] === undefined) continue
    out[key] = canonical(source[key])
  }
  return out
}

export const stableString = (value: unknown): string => JSON.stringify(canonical(value))

export const same = (left: unknown, right: unknown): boolean => stableString(left) === stableString(right)
