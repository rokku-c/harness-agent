import type { GatewayContext, GatewayRule } from "./contract.ts"

const same = (expected: string | undefined, actual: string | undefined) => expected === undefined || expected === actual

export const matchingRules = (rules: ReadonlyArray<GatewayRule>, context: GatewayContext): ReadonlyArray<GatewayRule> =>
  rules.filter((rule) => same(rule.match?.agent, context.agent)
    && same(rule.match?.session, context.session)
    && same(rule.match?.model, context.model)
    && same(rule.match?.path, context.path))
