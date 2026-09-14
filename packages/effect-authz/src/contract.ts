import type { Action } from "./action.ts"
import type { AuthzRecorder } from "./audit.ts"
import type { Decision } from "./decide.ts"
import type { GrantInput, PolicyEntry } from "./policy.ts"
import type { Principal, PrincipalKind } from "./principal.ts"
import type { Resource } from "./resource.ts"
import type { TemplateTable } from "./templates.ts"

export interface AuthzOptions {
  readonly templates?: TemplateTable
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
  revoke(subject: string, resource: Resource | string, actions?: readonly Action[]): number
  setTemplate(kind: PrincipalKind, entries: readonly PolicyEntry[]): void
  snapshot(): AuthzSnapshot
  view(principal: Principal): readonly PolicyEntry[]
  decide(principal: Principal, action: Action, resource: Resource): Decision
  visible(principal: Principal, action: Action, candidates: readonly Resource[]): readonly Resource[]
  require(principal: Principal, action: Action, resource: Resource): void
}
