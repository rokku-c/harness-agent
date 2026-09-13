/**
 * mcp-gateway rules — pure matching over principal / session / server / tool.
 *
 * A rule is written where it is matched, because the two are one idea: a rule
 * that named something the matcher does not read is a rule that silently never
 * fires, and there is no way to write that here.
 */

import { principalKey } from "@effect-agent/effect-authz"

import type { RuleDecision } from "./contract-audit.ts"
import type { McpGatewayContext } from "./contract.ts"

export interface McpGatewayRule {
  readonly ruleId: string
  /** Matching is over the principal key: a rule names an identity, not a hint. */
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
