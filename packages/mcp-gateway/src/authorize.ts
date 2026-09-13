/**
 * mcp-gateway — the authorization bridge.
 *
 * The gateway speaks in serverIds and tools; effect-authz speaks in resources
 * and principals. This file is the entire translation: one tool is the resource
 * `mcp://<serverId>/<tool>`, and calling it is the `call` action.
 *
 * Listing and calling run through the same engine, so a tool the projection
 * hides is a tool the direct call refuses — the two cannot drift apart.
 *
 * A call that names no tool addresses the server itself (`mcp://<serverId>`),
 * which is a shallower resource than any of its tools: a grant of
 * `mcp://board/*` authorizes each board tool but not the tool-less call.
 */

import type { Authz, Decision, Principal, Resource } from "@effect-agent/effect-authz"
import { serverResource, serverToolResource } from "@effect-agent/effect-authz"

export interface ToolRef {
  readonly serverId: string
  readonly tool: string
}

export const toolRefResource = (ref: ToolRef): Resource => serverToolResource(ref.serverId, ref.tool)

/** The subset of a catalog a principal may see, in catalog order. */
export const visibleToolRefs = (
  authz: Authz,
  principal: Principal,
  refs: readonly ToolRef[],
): readonly ToolRef[] => {
  const granted = new Set(authz.visible(principal, "call", refs.map(toolRefResource)).map((resource) => resource.raw))
  return refs.filter((ref) => granted.has(toolRefResource(ref).raw))
}

export type CallRefusal = "no_principal" | "denied"

export interface CallAuthorization {
  readonly allowed: boolean
  readonly resource: Resource
  readonly decision?: Decision
  /** Present exactly when `allowed` is false. */
  readonly refusal?: CallRefusal
}

export interface CallTarget {
  readonly principal?: Principal
  readonly serverId: string
  readonly tool?: string
}

export const authorizeCall = (authz: Authz, target: CallTarget): CallAuthorization => {
  const resource = target.tool ? serverToolResource(target.serverId, target.tool) : serverResource(target.serverId)
  if (target.principal === undefined) return { allowed: false, resource, refusal: "no_principal" }
  const decision = authz.decide(target.principal, "call", resource)
  return decision.allowed
    ? { allowed: true, resource, decision }
    : { allowed: false, resource, decision, refusal: "denied" }
}
