/**
 * effect-authz — the engine's public contract.
 *
 * Kept apart from engine.ts so the facade stays a thin implementation.
 */

import type { Action } from "./action.ts"
import type { AuthzRecorder } from "./audit.ts"
import type { Decision } from "./decide.ts"
import type { GrantInput, PolicyEntry } from "./policy.ts"
import type { Principal, PrincipalKind } from "./principal.ts"
import type { Resource } from "./resource.ts"
import type { TemplateTable } from "./templates.ts"

export interface AuthzOptions {
  /** Defaults to DEFAULT_TEMPLATES; the gateway overrides from the live registry. */
  readonly templates?: TemplateTable
  /** Seed entries, e.g. replayed from a caller's persistence via `snapshot()`. */
  readonly grants?: readonly PolicyEntry[]
  readonly recorder?: AuthzRecorder
  readonly now?: () => number
}

export interface AuthzSnapshot {
  readonly templates: TemplateTable
  readonly grants: readonly PolicyEntry[]
}

export interface Authz {
  grant(input: GrantInput): PolicyEntry
  /** Removes matching grants; returns how many were removed (0 on a repeat call). */
  revoke(subject: string, resource: Resource | string, actions?: readonly Action[]): number
  setTemplate(kind: PrincipalKind, entries: readonly PolicyEntry[]): void
  /** The persistence seam — no storage implementation lives in this package. */
  snapshot(): AuthzSnapshot
  view(principal: Principal): readonly PolicyEntry[]
  decide(principal: Principal, action: Action, resource: Resource): Decision
  visible(principal: Principal, action: Action, candidates: readonly Resource[]): readonly Resource[]
  /** Throws `effect-authz: denied — …` when the decision is not allowed. */
  require(principal: Principal, action: Action, resource: Resource): void
}
