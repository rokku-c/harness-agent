/**
 * The gateway's decision, on its own.
 *
 * A call and an advertisement ask the same question — may this caller do this?
 * — and they must get the same answer, or the door offers a tool it then
 * refuses. So the question is one function. `decide` walks the same sets, the
 * same grants and the same rules the call would run, and answers with the
 * verdict *and* the audit trail it produced. A caller that only wants to know
 * takes the verdict and drops the trail; a caller that acts records the trail
 * and then makes the call. Nothing decides twice, so nothing can disagree.
 */
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

/** The identity a binding is keyed by. A verified principal, and nothing else. */
const identityKey = (context: McpGatewayContext): string | undefined =>
  context.principal === undefined ? undefined : principalKey(context.principal)

export const makeDecide = (options: McpGatewayOptions) => {
  const rules = options.rules ?? []
  const fallback = options.defaultAction ?? "allow"

  /** Where the call goes, before anything decides whether it may. */
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

    // A gateway with sets but no verified caller has nobody to look up: its sets
    // are keyed by identity, so a nameless call reaches nothing at all.
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
