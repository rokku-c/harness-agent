/** MCP gateway pipeline: resolve, authorize, proxy, and audit. */
import type { McpGatewayContext, McpGatewayEvent, McpGatewayOptions, McpGatewayResult } from "./contract.ts"
import { decideAction } from "./rules.ts"
import { redactArgs } from "./redaction.ts"

export interface McpGateway { handle(context: McpGatewayContext): Promise<McpGatewayResult> }
type Target = { readonly serverId?: string; readonly setId?: string; readonly deniedBySet: boolean }

export function makeMcpGateway(options: McpGatewayOptions): McpGateway {
  const rules = options.rules ?? [], fallback = options.defaultAction ?? "allow"
  const captureArgs = options.captureArgs === true
  const emit = async (type: McpGatewayEvent["type"], ctx: McpGatewayContext, extra: Partial<McpGatewayEvent> = {}) =>
    options.recorder?.record({ callId: ctx.callId, type, at: Date.now(), agent: ctx.agent, ...(ctx.setId ? { setId: ctx.setId } : {}), serverId: ctx.serverId, tool: ctx.tool, ...extra })
  const target = async (context: McpGatewayContext): Promise<Target> => {
    const registry = options.setRegistry
    if (registry && (context.setId !== undefined || context.agent !== undefined)) {
      const resolved = registry.resolve(context.agent, context.setId, context.tool ?? "")
      return { serverId: resolved?.serverId, setId: resolved?.setId, deniedBySet: resolved?.allowed === false }
    }
    if (context.serverId) return { serverId: context.serverId, deniedBySet: false }
    const resolved = await options.resolver?.resolve(context)
    return { serverId: resolved?.serverId, deniedBySet: false }
  }
  return { handle: async (context) => {
    const started = Date.now(), found = await target(context)
    if (!found.serverId) {
      await emit("error", context, { status: 404, detail: `no server resolved for call ${context.callId}` })
      return { ok: false, status: 404, decision: "deny", detail: "no_server" }
    }
    const ctx = { ...context, serverId: found.serverId, ...(found.setId ? { setId: found.setId } : {}) }
    const resultSet = found.setId ? { setId: found.setId } : {}
    await emit("call", ctx)
    if (found.deniedBySet) {
      await emit("error", ctx, { decision: "deny", status: 403, detail: "denied_by_set", durationMs: Date.now() - started })
      return { ok: false, status: 403, serverId: found.serverId, ...resultSet, decision: "deny", detail: "denied_by_set", durationMs: Date.now() - started }
    }
    const { rule, decision } = decideAction(rules, ctx, fallback)
    if (rule) await emit("rule", ctx, { ruleId: rule.ruleId, decision })
    if (decision === "deny") {
      await emit("error", ctx, { ruleId: rule?.ruleId, decision, status: 403, detail: "denied_by_rule" })
      return { ok: false, status: 403, serverId: found.serverId, ...(found.setId ? { setId: found.setId } : {}), decision, ruleId: rule?.ruleId, detail: "denied_by_rule", durationMs: Date.now() - started }
    }
    const upstream = await options.upstream.call({ serverId: found.serverId, tool: ctx.tool ?? "", args: ctx.args })
    const ok = upstream.ok || (upstream.status >= 200 && upstream.status < 300)
    const extra = { ruleId: rule?.ruleId, decision, status: upstream.status, durationMs: upstream.durationMs, detail: upstream.detail, ...(captureArgs ? { argsRedacted: redactArgs(ctx.args) } : {}) }
    await emit(ok ? "response" : "error", ctx, extra)
    return { ok, status: upstream.status, serverId: found.serverId, ...resultSet, decision, ruleId: rule?.ruleId, detail: upstream.detail, durationMs: upstream.durationMs }
  } }
}
