/**
 * effect-authz — per-kind default templates.
 *
 * A template is data, not logic: the kind only decides which baseline surface a
 * principal starts from. `$self` is the single dynamic part — it stands for the
 * principal's own namespace, so `user:alice` reaches `alice` and below without
 * needing an ownership field on the data itself.
 *
 * These are principle-level defaults; the gateway is expected to override them
 * from the live mcp-registry topology via `setTemplate`.
 */

import type { Action } from "./action.ts"
import { ANY_SUBJECT, type PolicyEntry } from "./policy.ts"
import { principalKey, type Principal } from "./principal.ts"
import { REST_SEGMENT, asResource } from "./resource.ts"

/** Placeholder segment replaced by the principal's own id. */
export const SELF = "$self"

export interface TemplateTable {
  readonly user: readonly PolicyEntry[]
  readonly app: readonly PolicyEntry[]
  readonly system: readonly PolicyEntry[]
}

const rule = (resource: string, actions: readonly Action[]): PolicyEntry => ({
  subject: ANY_SUBJECT,
  resource: asResource(resource),
  actions,
  effect: "allow",
  source: "template",
})

/** user → own namespace, read+call. app → own namespace, call. system → everything. */
export const DEFAULT_TEMPLATES: TemplateTable = {
  user: [rule(SELF, ["read", "call"])],
  app: [rule(SELF, ["call"])],
  system: [rule(REST_SEGMENT, ["read", "call", "write"])],
}

const substitute = (raw: string, principal: Principal): string => raw.split(SELF).join(principal.id)

/** Materialize a kind's template for one principal: bind `$self`, bind the subject. */
export const templateEntries = (table: TemplateTable, principal: Principal): readonly PolicyEntry[] => {
  const key = principalKey(principal)
  return table[principal.kind].map((entry) => ({
    ...entry,
    subject: entry.subject === ANY_SUBJECT ? key : entry.subject,
    resource: asResource(substitute(entry.resource.raw, principal)),
  }))
}
