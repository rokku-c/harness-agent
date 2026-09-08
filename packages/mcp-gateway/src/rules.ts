/**
 * mcp-gateway rules — pure matching over agent / session / server / tool.
 */

import type {
  McpGatewayContext,
  McpGatewayRule,
  RuleDecision,
} from "./contract.ts"

function matches(rule: McpGatewayRule, ctx: McpGatewayContext): boolean {
  const m = rule.match
  if (!m) return true
  if (m.agent !== undefined && m.agent !== ctx.agent) return false
  if (m.session !== undefined && m.session !== ctx.session) return false
  if (m.serverId !== undefined && m.serverId !== ctx.serverId) return false
  if (m.tool !== undefined && m.tool !== ctx.tool) return false
  return true
}

/** First matching rule wins; rules earlier in the list take precedence. */
export function evaluateRules(
  rules: readonly McpGatewayRule[],
  ctx: McpGatewayContext,
): McpGatewayRule | undefined {
  return rules.find((rule) => matches(rule, ctx))
}

/** The effective action for a context: matching rule action, else fallback. */
export function decideAction(
  rules: readonly McpGatewayRule[],
  ctx: McpGatewayContext,
  fallback: RuleDecision = "allow",
): { readonly rule?: McpGatewayRule; readonly decision: RuleDecision } {
  const rule = evaluateRules(rules, ctx)
  return rule ? { rule, decision: rule.action } : { decision: fallback }
}
