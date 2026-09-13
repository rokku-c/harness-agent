/**
 * Allowlist pattern matching for effect.boundary.json.
 *
 * `*` stays within one path segment; `**` crosses segments. Patterns match
 * repo-relative posix paths, so the same helper serves package dirs, target
 * paths and single files.
 */

export const matches = (pattern: string, value: string): boolean => {
  const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const segment = (part: string): string => part.split("*").map(escape).join("[^/]*")
  const rx = new RegExp("^" + pattern.split("**").map(segment).join(".*") + "$")
  return rx.test(value)
}
