const secret = /(^|[-_])(authorization|api[-_]?key|token|secret|cookies?|credentials?)([-_]|$)/i

export const isCredentialHeader = (name: string): boolean => secret.test(name)

export const redact = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(redact)
  if (typeof value !== "object" || value === null) return value
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, secret.test(key) ? "[REDACTED]" : redact(child)]))
}

export const safeHeaders = (headers: Headers): Record<string, string> =>
  Object.fromEntries([...headers].filter(([key]) => !secret.test(key)))

export const digestText = async (value: string): Promise<string> => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
