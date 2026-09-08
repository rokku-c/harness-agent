import { AgentDeck, makeDemoGateway, makeClaudeSdkGateway, effectGateway,
  makeEffectOpsGateway, makeCliGateway } from "@effect-agent/agentdeck"
import type { DeckOptions } from "./options.ts"
import type { makePresets } from "./presets.ts"

export type SessionPolicy = { auto: ReadonlySet<string>; mode: "ask" | "allow" | "deny" }
export const makeGateways = (options: DeckOptions, presets: ReturnType<typeof makePresets>) => {
  const deck = new AgentDeck()
  const sessionPolicy = new Map<string, SessionPolicy>()
  deck.register(makeDemoGateway({ ask: (sessionId, tool, input) => {
    const callId = deck.consent.ask(sessionId, tool, input)
    const policy = sessionPolicy.get(sessionId)
    if (policy && (policy.auto.has(tool) || policy.mode !== "ask")) {
      deck.consent.resolve(callId, policy.auto.has(tool) || policy.mode === "allow", "auto")
    }
    return callId
  } }))
  if (options.claudeSdk) deck.register(makeClaudeSdkGateway({ query: options.claudeSdk.query }))
  const gatewayFor = (kind: string) => {
    const booted = deck.get(kind)
    if (booted) return booted
    if ((kind === "effect" || kind === "effect-ops") && !options.effectModel) {
      throw new Error(kind + " kind needs effectModel at boot")
    }
    const gateway = kind === "effect" ? effectGateway({ model: options.effectModel! })
      : kind === "effect-ops" ? makeEffectOpsGateway({ model: options.effectModel!, ledger: deck.consent })
      : makeCliGateway(kind as never, { presets: presets.all() })
    deck.register(gateway)
    return gateway
  }
  return { deck, sessionPolicy, gatewayFor }
}
