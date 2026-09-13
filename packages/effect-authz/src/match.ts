/**
 * effect-authz — stratified coverage.
 *
 * `covers(grant, target)` answers "does a grant written this way reach this
 * resource?". Three rules, in order:
 *
 * 1. Scheme: a grant with no scheme covers any scheme; a named scheme covers
 *    only its own. So `ops` reaches `ops::board.view` *and* `ui://ops/board/main`,
 *    while `ui://ops/board/main` reaches only itself.
 * 2. Segments align from the left. `*` consumes exactly one segment; a literal
 *    must be equal.
 * 3. Depth: an exact-length match always covers. A deeper target is covered only
 *    when the grant is literal-only (a container grant inherits downward: `ops`,
 *    `ops::board`). Using `*` pins the depth, and a terminal `**` requires one or
 *    more further segments.
 */

import { ANY_SEGMENT, REST_SEGMENT, parseResource, type Resource } from "./resource.ts"

const alignsAt = (grant: readonly string[], target: readonly string[]): boolean => {
  for (let index = 0; index < grant.length; index++) {
    const segment = grant[index]
    if (segment !== ANY_SEGMENT && segment !== target[index]) return false
  }
  return true
}

export const covers = (grant: Resource, target: Resource): boolean => {
  const g = parseResource(grant.raw)
  const t = parseResource(target.raw)
  if (g.scheme !== "" && g.scheme !== t.scheme) return false
  const rest = g.segments[g.segments.length - 1] === REST_SEGMENT
  const head = rest ? g.segments.slice(0, -1) : g.segments
  if (head.length > t.segments.length) return false
  if (!alignsAt(head, t.segments)) return false
  if (rest) return head.length < t.segments.length
  if (head.length === t.segments.length) return true
  return !head.includes(ANY_SEGMENT)
}

/** Diagnostics only — the verdict is deny-overrides, which is order-independent. */
export const specificityOf = (resource: Resource): number => {
  const { segments } = parseResource(resource.raw)
  if (segments[segments.length - 1] === REST_SEGMENT) return 0
  return segments.filter((segment) => segment !== ANY_SEGMENT && segment !== REST_SEGMENT).length
}
