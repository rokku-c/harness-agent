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

export const stableString = (value: unknown): string =>
  JSON.stringify(canonical(value)) ?? "undefined"

export const same = (left: unknown, right: unknown): boolean => stableString(left) === stableString(right)
