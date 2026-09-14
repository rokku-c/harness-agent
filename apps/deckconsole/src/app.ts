import { toEffectTools } from "@effect-agent/effect-interface"
import { makeDeckDomain } from "./domain/deck.ts"
import { makeRouter } from "./http/router.ts"
import { deckOperations } from "./ops/index.ts"
import type { DeckOptions } from "./domain/options.ts"

export type { DeckOptions } from "./domain/options.ts"
export const createDeckApp = (options: DeckOptions = {}) => {
  const domain = makeDeckDomain(options)
  const operations = deckOperations(domain)
  const router = makeRouter(operations)
  let closed = false
  return {
    deck: domain.deck,
    handle: async (request: Request) => closed ? new Response("Deck closed", { status: 503 }) : router(request),
    close: () => { closed = true; return domain.close() },
    tools: toEffectTools(operations),
  }
}
