import { principalKey } from "@effect-agent/effect-authz"

import type { RuleDecision } from "./contract-audit.ts"
import type { McpGatewayContext } from "./contract.ts"

export interface McpGatewayRule {
  readonly ruleId: string
  readonly match?: { readonly principal?: string; readonly session?: string; readonly serverId?: string; readonly tool?: string }
  readonly action: RuleDecision
}

function matches(rule: McpGatewayRule, ctx: McpGatewayContext): boolean {
  const m = rule.match
  if (!m) return true
  if (m.principal !== undefined && m.principal !== (ctx.principal === undefined ? undefined : principalKey(ctx.principal))) return false
  if (m.session !== undefined && m.session !== ctx.session) return false
  if (m.serverId !== undefined && m.serverId !== ctx.serverId) return false
  if (m.tool !== undefined && m.tool !== ctx.tool) return false
  return true
}

export function evaluateRules(
  rules: readonly McpGatewayRule[],
  ctx: McpGatewayContext,
): McpGatewayRule | undefined {
  return rules.find((rule) => matches(rule, ctx))
}

export function decideAction(
  rules: readonly McpGatewayRule[],
  ctx: McpGatewayContext,
  fallback: RuleDecision = "allow",
): { readonly rule?: McpGatewayRule; readonly decision: RuleDecision } {
  const rule = evaluateRules(rules, ctx)
  return rule ? { rule, decision: rule.action } : { decision: fallback }
}
