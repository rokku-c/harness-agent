/**
 * Matching a control-surface request against the declared host operations: each
 * path template becomes an anchored matcher once, at load, so dispatch is one
 * pass over five compiled patterns rather than a per-request parse.
 */
import type { HostOperation } from "./operations.ts"
import { HOST_OPERATIONS } from "./operation-table.ts"

/** Turn a path template into an anchored matcher, leaving literals escaped. */
const patternOf = (template: string): RegExp =>
  new RegExp(
    "^" +
      template
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        .replace(/:[A-Za-z_][A-Za-z0-9_]*/g, "([^/]+)") +
      "$",
  )

const namesOf = (template: string): readonly string[] =>
  [...template.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1])

const matchers = HOST_OPERATIONS.map((operation) => ({
  operation,
  pattern: patternOf(operation.path),
  names: namesOf(operation.path),
}))

export interface HostOperationMatch {
  readonly operation: HostOperation
  /** Template parameters, URL-decoded — `{ id: "board" }` for `/-/planes/board/enable`. */
  readonly params: Readonly<Record<string, string>>
}

/** Match a control-surface request against the declaration; undefined = not a control path. */
export const matchHostOperation = (method: string, path: string): HostOperationMatch | undefined => {
  for (const { operation, pattern, names } of matchers) {
    if (operation.method !== method) continue
    const match = pattern.exec(path)
    if (match === null) continue
    const params: Record<string, string> = {}
    names.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1])
    })
    return { operation, params }
  }
  return undefined
}
