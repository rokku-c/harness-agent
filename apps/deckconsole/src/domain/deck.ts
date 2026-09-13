import { makeLauncherStore } from "./launchers.ts"
import { makeGateways } from "./gateways.ts"
import { makePresets } from "./presets.ts"
import type { DeckOptions } from "./options.ts"

export const makeDeckDomain = (options: DeckOptions) => {
  const presets = makePresets()
  const gateways = makeGateways(options, presets)
  const store = makeLauncherStore(options.configFile ?? ".effect-agent/deckconsole.sqlite", options.launchers ?? [])
  if (options.effectModel) {
    store.seed("effect", "effect (in-process)")
    store.seed("effect-ops", "effect-ops (approval loop)")
  }
  if (options.claudeSdk) store.seed("claude-cc", "claude-cc (SDK, in-process)")
  const lastTurn = new Map<string, string>()
  const sessionGateway = (id: string) => {
    const kind = gateways.deck.sessions().find(s => s.sessionId === id)?.kind
    return kind === undefined ? undefined : gateways.deck.get(kind)
  }
  const closeSession = async (id: string) => {
    await sessionGateway(id)?.close(id)
    gateways.sessionPolicy.delete(id)
    lastTurn.delete(id)
  }
  let closing: Promise<void> | undefined
  const close = () => closing ??= (async () => {
    try {
      const results = await Promise.allSettled(gateways.deck.sessions().map(s => closeSession(s.sessionId)))
      const failures = results.filter(r => r.status === "rejected").map(r => r.reason)
      if (failures.length) throw new AggregateError(failures, "Failed to close deck sessions")
    } finally { lastTurn.clear(); presets.dynamic.clear(); gateways.sessionPolicy.clear(); store.close() }
  })()
  return { ...gateways, store, presets, lastTurn, sessionGateway, closeSession, close }
}
export type DeckDomain = ReturnType<typeof makeDeckDomain>
