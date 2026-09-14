import { principalKey } from "@effect-agent/effect-authz"

import { authorizeCall } from "./authorize.ts"
import type { McpGatewayEvent, RuleDecision } from "./contract-audit.ts"
import type { McpGatewayContext, McpGatewayOptions, McpGatewayVerdict } from "./contract.ts"
import { decideAction } from "./rules.ts"

interface Target {
  readonly serverId?: string
  readonly setId?: string
  readonly deniedBySet: boolean
}

const identityKey = (context: McpGatewayContext): string | undefined =>
  context.principal === undefined ? undefined : principalKey(context.principal)

export const makeDecide = (options: McpGatewayOptions) => {
  const rules = options.rules ?? []
  const fallback = options.defaultAction ?? "allow"

  const target = async (context: McpGatewayContext): Promise<Target> => {
    const registry = options.setRegistry
    if (registry !== undefined) {
      const agent = identityKey(context)
      if (agent === undefined) return { deniedBySet: false }
      const resolved = registry.resolve({ agent, setId: context.setId, serverId: context.serverId, tool: context.tool })
      return { serverId: resolved?.serverId, setId: resolved?.setId, deniedBySet: resolved?.allowed === false }
    }
    if (context.serverId !== undefined) return { serverId: context.serverId, deniedBySet: false }
    return { serverId: (await options.resolver?.resolve(context))?.serverId, deniedBySet: false }
  }

  return async (input: McpGatewayContext): Promise<McpGatewayVerdict> => {
    const started = Date.now()
    const trace: McpGatewayEvent[] = []
    const note = (type: McpGatewayEvent["type"], context: McpGatewayContext, extra: Partial<McpGatewayEvent> = {}): void => {
      trace.push({
        callId: context.callId, type, at: Date.now(),
        ...(context.principal === undefined ? {} : { principal: principalKey(context.principal) }),
        ...(context.setId === undefined ? {} : { setId: context.setId }),
        serverId: context.serverId, tool: context.tool, ...extra,
      })
    }
    const refuse = (
      status: number, detail: string, context: McpGatewayContext,
      routed: { readonly serverId?: string; readonly setId?: string } = {},
      ruleId?: string,
    ): McpGatewayVerdict => {
      note("error", context, { decision: "deny", status, detail, durationMs: Date.now() - started })
      return { allowed: false, status, detail, decision: "deny", trace, ...routed, ...(ruleId === undefined ? {} : { ruleId }) }
    }

    if (options.setRegistry !== undefined && identityKey(input) === undefined) return refuse(401, "no_principal", input)

    const found = await target(input)
    if (found.serverId === undefined) {
      note("error", input, { status: 404, detail: `no server resolved for call ${input.callId}` })
      return { allowed: false, status: 404, detail: "no_server", decision: "deny", trace }
    }
    const context: McpGatewayContext = { ...input, serverId: found.serverId, ...(found.setId === undefined ? {} : { setId: found.setId }) }
    const routed = { serverId: found.serverId, ...(found.setId === undefined ? {} : { setId: found.setId }) }
    note("call", context)
    if (found.deniedBySet) return refuse(403, "denied_by_set", context, routed)

    const gate = options.authz === undefined ? undefined : authorizeCall(options.authz, { principal: context.principal, serverId: found.serverId, tool: context.tool })
    if (gate !== undefined && !gate.allowed) {
      note("authz", context, { decision: "deny", detail: gate.decision?.reason ?? gate.refusal })
      return refuse(403, gate.refusal === "no_principal" ? "no_principal" : "denied_by_principal", context, routed)
    }
    if (gate !== undefined) note("authz", context, { decision: "allow", detail: gate.decision?.reason })

    const { rule, decision } = decideAction(rules, context, fallback)
    if (rule !== undefined) note("rule", context, { ruleId: rule.ruleId, decision })
    if (decision === "deny") return refuse(403, "denied_by_rule", context, routed, rule?.ruleId)
    return {
      allowed: true, decision, serverId: found.serverId,
      ...(found.setId === undefined ? {} : { setId: found.setId }),
      ...(rule === undefined ? {} : { ruleId: rule.ruleId }), trace,
    }
  }
}
