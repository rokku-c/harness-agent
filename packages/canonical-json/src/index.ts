/**
 * Key-order-independent JSON: one canonical encoding, and equality over it.
 *
 * Two code paths can describe the same thing with their keys in a different
 * order — `artifactOf` emits `kind` before `abi` while the validator rebuilds the
 * object the other way round, and a tool's JSON Schema follows its fields'
 * declaration order. `JSON.stringify` calls those different, so a naive diff
 * reports a phantom "update" every time a node is re-pushed, which is precisely
 * the noise that trains people to stop reading diffs.
 *
 * Sorting is the whole of what this may do. A value carrying its own `toJSON` —
 * a `Date` above all — has no own keys to sort, so reading it as a record
 * canonicalizes it to `{}`: the encoding an empty object gets, and the encoding
 * every other date gets. Two frames that differ only in a timestamp would then
 * be one observation, and a change detector reading "unchanged" never records
 * the second. It is visited through `toJSON` first, which is what
 * `JSON.stringify` does with it — and what the observation store does with it
 * when it writes the frame, so the two encodings agree.
 *
 * `Formal/Canonical.lean` proves the rule: reordering is what the encoding is
 * for, dropping a value is not.
 */

/** The value `JSON.stringify` would visit next: a `toJSON` first, then the value. */
const encodedOf = (value: unknown): unknown => {
  if (value === null || typeof value !== "object") return value
  const method = (value as { toJSON?: unknown }).toJSON
  return typeof method !== "function" ? value : encodedOf((method as (this: unknown) => unknown).call(value))
}

const canonical = (value: unknown): unknown => {
  const encoded = encodedOf(value)
  if (Array.isArray(encoded)) return encoded.map(canonical)
  if (encoded === null || typeof encoded !== "object") return encoded
  const source = encoded as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(source).sort()) {
    if (source[key] === undefined) continue
    out[key] = canonical(source[key])
  }
  return out
}

/**
 * The canonical JSON of a value: two values a reader would call equal stringify
 * alike whatever order their keys are in. `JSON.stringify` yields no string for a
 * value it cannot encode, and the token is what keeps such a value from reading
 * as a `null`.
 */
export const stableString = (value: unknown): string =>
  JSON.stringify(canonical(value)) ?? "undefined"

/** Whether two values are the same data, whatever order their keys are in. */
export const same = (left: unknown, right: unknown): boolean => stableString(left) === stableString(right)
