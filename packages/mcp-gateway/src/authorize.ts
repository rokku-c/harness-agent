import type { Authz, Decision, Principal, Resource } from "@effect-agent/effect-authz"
import { serverResource, serverToolResource } from "@effect-agent/effect-authz"

export interface ToolRef {
  readonly serverId: string
  readonly tool: string
}

export const toolRefResource = (ref: ToolRef): Resource => serverToolResource(ref.serverId, ref.tool)

export type CallRefusal = "no_principal" | "denied"

export interface CallAuthorization {
  readonly allowed: boolean
  readonly resource: Resource
  readonly decision?: Decision
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
