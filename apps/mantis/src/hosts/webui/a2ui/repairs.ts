/**
 * a2ui/repairs.ts - TARGETED REPAIRS for recurring agent habits.
 *
 * Concept: agents routinely emit props the official STRICT schemas reject
 * (a rejected component blanks the whole surface in the official renderer).
 * These are the recoverable habits seen live, each mapped to the equivalent
 * valid official shape: action without the event wrapper gets wrapped, src
 * is renamed to url, unknown props are stripped, wrongly-typed optional
 * props are dropped, a missing single child is promoted from a one-element
 * children list.
 */
import type { CatalogIssue } from "./catalog.ts"

/** agent writes action: {name, context} but the official shape is action.event.name */
export const repairAction = (value: unknown): unknown => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (record.event !== undefined) return value
  if (typeof record.name === "string") {
    return { event: { name: record.name, context: record.context ?? {} } }
  }
  return value
}

/** rename/rename-before-strip + drop unknown props; returns the working copy */
export const stripProps = (
  props: Record<string, unknown>,
  allowed: Set<string>,
  renamed: Record<string, string>
): Record<string, unknown> => {
  const candidate: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (allowed.has(key)) { candidate[key] = value; continue }
    const mapped = renamed[key]
    if (mapped !== undefined && allowed.has(mapped) && candidate[mapped] === undefined)
      candidate[mapped] = value // rename before stripping so the value survives
  }
  return candidate
}

/** apply ONE schema issue as a repair; true when anything changed */
export const applyIssueRepair = (
  candidate: Record<string, unknown>,
  comp: Record<string, unknown>,
  issue: CatalogIssue
): boolean => {
  const pathKey = issue.path?.[0]
  if (typeof pathKey !== "string") return false
  if (issue.code === "invalid_enum_value") { delete candidate[pathKey]; return true }
  if (pathKey === "action") {
    const fixed = repairAction(candidate.action)
    if (fixed !== candidate.action) { candidate.action = fixed; return true }
    return false
  }
  if (pathKey === "url" && candidate.url === undefined && typeof candidate.src === "string") {
    candidate.url = candidate.src
    delete candidate.src
    return true
  }
  if ((issue.code === "invalid_type" || issue.code === "custom" || issue.code === "invalid_union") && candidate[pathKey] !== undefined) {
    // a present but wrongly typed optional prop (e.g. TextField label): drop it, keep the rest
    delete candidate[pathKey]
    return true
  }
  if (issue.code === "invalid_type" && candidate.child === undefined) {
    // a single-child container (Card/Button...) missing its required child:
    // promote the one id, if the agent used a single-element children list
    const rawChildren = comp.children
    const ids = Array.isArray(rawChildren) ? rawChildren.filter((x): x is string => typeof x === "string") : []
    if (ids.length === 1) { candidate.child = ids[0]; return true }
  }
  return false
}
