const SENSITIVE_KEY = new Set([
  "authorization",
  "api_key",
  "apikey",
  "api-key",
  "token",
  "access_token",
  "password",
  "secret",
  "client_secret",
  "private_key",
])

const REDACTED = "[REDACTED]"

export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.has(key.toLowerCase())
}

export function redactArgs(
  args: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> | undefined {
  if (args === undefined) return undefined

  const scrub = (value: unknown, key?: string): unknown => {
    if (key !== undefined && isSensitiveKey(key)) return REDACTED
    if (Array.isArray(value)) return value.map((item) => scrub(item))
    if (value !== null && typeof value === "object" && value.constructor === Object) {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(value)) out[k] = scrub(v, k)
      return out
    }
    return value
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(args)) result[key] = scrub(value, key)
  return result
}
