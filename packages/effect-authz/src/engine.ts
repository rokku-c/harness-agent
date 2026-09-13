/**
 * effect-authz — in-memory engine facade.
 *
 * Pure: no I/O, no token handling, no storage. Templates and grants live here;
 * `snapshot()` is the only seam a caller needs to persist them, and
 * `AuthzOptions.grants` is how it seeds them back.
 */

import type { Action } from "./action.ts"
import { noopRecorder } from "./audit.ts"
import type { Authz, AuthzOptions, AuthzSnapshot } from "./contract.ts"
import { resolveDecision } from "./decide.ts"
import { grantEntry, type GrantInput, type PolicyEntry } from "./policy.ts"
import { principalKey, type Principal, type PrincipalKind } from "./principal.ts"
import { asResource, type Resource } from "./resource.ts"
import { DEFAULT_TEMPLATES, type TemplateTable } from "./templates.ts"
import { resolveView } from "./view.ts"
import { visibleResources } from "./visible.ts"

export const makeAuthz = (options: AuthzOptions = {}): Authz => {
  let templates: TemplateTable = options.templates ?? DEFAULT_TEMPLATES
  const grants: PolicyEntry[] = [...(options.grants ?? [])]
  const recorder = options.recorder ?? noopRecorder
  const now = options.now ?? (() => Date.now())

  const view = (principal: Principal): readonly PolicyEntry[] => resolveView(templates, grants, principal)

  const decide = (principal: Principal, action: Action, resource: Resource) => {
    const key = principalKey(principal)
    const decision = resolveDecision(view(principal), key, action, resource)
    recorder.record({
      at: now(),
      principalKey: key,
      kind: principal.kind,
      action,
      resource: resource.raw,
      allowed: decision.allowed,
      reason: decision.reason,
      ...(decision.matchedBy ? { source: decision.matchedBy.source } : {}),
    })
    return decision
  }

  const revoke = (subject: string, resource: Resource | string, actions?: readonly Action[]): number => {
    const target = typeof resource === "string" ? asResource(resource) : resource
    const keep: PolicyEntry[] = []
    let removed = 0
    for (const entry of grants) {
      const hit = entry.subject === subject && entry.resource.raw === target.raw &&
        (actions === undefined || entry.actions.some((action) => actions.includes(action)))
      if (hit) removed++
      else keep.push(entry)
    }
    grants.length = 0
    grants.push(...keep)
    return removed
  }

  return {
    grant: (input: GrantInput): PolicyEntry => {
      const entry = grantEntry(input)
      grants.push(entry)
      return entry
    },
    revoke,
    setTemplate: (kind: PrincipalKind, entries: readonly PolicyEntry[]): void => {
      templates = { ...templates, [kind]: entries }
    },
    snapshot: (): AuthzSnapshot => ({ templates, grants: [...grants] }),
    view,
    decide,
    visible: (principal, action, candidates) =>
      visibleResources(view(principal), principalKey(principal), action, candidates),
    require: (principal, action, resource) => {
      const decision = decide(principal, action, resource)
      if (!decision.allowed) {
        const key = principalKey(principal)
        throw new Error(`effect-authz: denied — ${key} cannot ${action} ${resource.raw} (${decision.reason})`)
      }
    },
  }
}
