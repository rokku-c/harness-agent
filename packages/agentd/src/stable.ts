/**
 * Key-order-independent structural equality.
 *
 * Two code paths can describe the same artifact with their keys in a different
 * order — `artifactOf` emits `kind` before `abi`, while the validator rebuilds
 * the object the other way round. `JSON.stringify` calls those different, so a
 * naive diff reports a phantom "update" every time a node is re-pushed, which is
 * precisely the noise that trains people to stop reading diffs.
 *
 * Sorting is the whole of what this may do. A value carrying its own `toJSON` —
 * a `Date` above all — has no own keys to sort, so reading it as a record
 * canonicalizes it to `{}`: the encoding an empty object gets, and the encoding
 * every other date gets, so two artifacts differing only in a date compare equal
 * and `same` answering "nothing changed" is a change nobody looks at again. It
 * is visited through `toJSON` first, which is what `JSON.stringify` does with it.
 */
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

export const stableString = (value: unknown): string => JSON.stringify(canonical(value))

export const same = (left: unknown, right: unknown): boolean => stableString(left) === stableString(right)
