/**
 * mcp-gateway redaction — scrub secrets from tool args before they reach the
 * audit log. Authorization-style headers are never modeled as capturable
 * fields at all; this protects the argument payload only.
 */

/** Keys treated as secrets, matched case-insensitively. */
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

/**
 * Deep copy of an args object with sensitive leaves replaced by REDACTED and
 * arrays recursively scrubbed. Non-plain values (functions, class instances)
 * are passed through untouched.
 */
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
