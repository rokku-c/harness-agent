/**
 * effect-authz — policy entries.
 *
 * One entry says: <subject> may (allow) or may not (deny) perform <actions> on
 * <resource>, and where that statement came from. Entries come from three
 * independent sources — the kind template, a declared/consented grant, and an
 * operator revoke — which is why the resolver cannot be order-dependent.
 */

import type { Action } from "./action.ts"
import { covers } from "./match.ts"
import { asResource, type Resource } from "./resource.ts"

export type Effect = "allow" | "deny"
export type Source = "template" | "manifest" | "consent" | "operator"

export interface PolicyEntry {
  readonly subject: string
  readonly resource: Resource
  readonly actions: readonly Action[]
  readonly effect: Effect
  readonly source: Source
}

export interface GrantInput {
  readonly subject: string
  readonly resource: Resource | string
  readonly actions: readonly Action[]
  readonly effect?: Effect
  readonly source?: Source
}

export const ANY_SUBJECT = "*"

/** `*` matches every principal; `user:*` matches any principal of that kind; else exact key. */
export const subjectMatches = (pattern: string, key: string): boolean => {
  if (pattern === ANY_SUBJECT) return true
  if (pattern.endsWith(":*")) return key.startsWith(pattern.slice(0, -1))
  return pattern === key
}

export const entryCovers = (entry: PolicyEntry, subject: string, action: Action, target: Resource): boolean =>
  subjectMatches(entry.subject, subject) && entry.actions.includes(action) && covers(entry.resource, target)

export const grantEntry = (input: GrantInput): PolicyEntry => ({
  subject: input.subject,
  resource: typeof input.resource === "string" ? asResource(input.resource) : input.resource,
  actions: [...input.actions],
  effect: input.effect ?? "allow",
  source: input.source ?? "consent",
})
