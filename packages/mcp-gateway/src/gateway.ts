/**
 * MCP gateway pipeline: decide, record, proxy.
 *
 * `handle` is `decide` plus the two things a caller that acts must do: write
 * the audit trail the decision produced, and make the call. Nothing about
 * *whether* the call may happen lives here — that was already answered, and it
 * is the same answer the advertised surface was built from, so a tool the door
 * offered is a tool this door carries.
 */
import { principalKey } from "@effect-agent/effect-authz"

import type { McpGatewayEvent } from "./contract-audit.ts"
import type { McpGateway, McpGatewayContext, McpGatewayOptions, McpGatewayResult } from "./contract.ts"
import { makeDecide } from "./gateway-decide.ts"
import { redactArgs } from "./redaction.ts"

export type { McpGateway } from "./contract.ts"

export function makeMcpGateway(options: McpGatewayOptions): McpGateway {
  const decide = makeDecide(options)
  const captureArgs = options.captureArgs === true
  const record = async (events: readonly McpGatewayEvent[]): Promise<void> => {
    for (const event of events) await options.recorder?.record(event)
  }
  const routedOf = (verdict: { serverId?: string; setId?: string }) => ({
    ...(verdict.serverId === undefined ? {} : { serverId: verdict.serverId }),
    ...(verdict.setId === undefined ? {} : { setId: verdict.setId }),
  })

  return {
    decide,
    handle: async (context: McpGatewayContext): Promise<McpGatewayResult> => {
      const verdict = await decide(context)
      await record(verdict.trace)
      const routed = routedOf(verdict)
      if (!verdict.allowed) {
        return { ok: false, status: verdict.status, decision: verdict.decision, detail: verdict.detail, ...routed,
          ...(verdict.ruleId === undefined ? {} : { ruleId: verdict.ruleId }) }
      }
      const upstream = await options.upstream.call({ serverId: verdict.serverId, tool: context.tool ?? "", args: context.args })
      const ok = upstream.ok || (upstream.status >= 200 && upstream.status < 300)
      await record([{
        callId: context.callId, type: ok ? "response" : "error", at: Date.now(),
        ...(context.principal === undefined ? {} : { principal: principalKey(context.principal) }),
        ...routed, tool: context.tool, ruleId: verdict.ruleId, decision: verdict.decision,
        status: upstream.status, durationMs: upstream.durationMs, detail: upstream.detail,
        ...(captureArgs ? { argsRedacted: redactArgs(context.args) } : {}),
      }])
      return { ok, status: upstream.status, decision: verdict.decision, detail: upstream.detail,
        durationMs: upstream.durationMs, ...routed, ...(verdict.ruleId === undefined ? {} : { ruleId: verdict.ruleId }) }
    },
  }
}
