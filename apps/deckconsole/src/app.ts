import { toEffectTools } from "@effect-agent/effect-interface"
import { makeDeckDomain } from "./domain/deck.ts"
import { makeRouter } from "./http/router.ts"
import { deckOperations } from "./ops/index.ts"
import type { DeckOptions } from "./domain/options.ts"

export type { DeckOptions } from "./domain/options.ts"
/** Owns state and SQLite, never a socket. Every load creates an independent app. */
export const createDeckApp = (options: DeckOptions = {}) => {
  const domain = makeDeckDomain(options)
  // one list, projected twice: the routes this app answers and the tools it offers
  const operations = deckOperations(domain)
  const router = makeRouter(operations, options.basePath ?? "")
  let closed = false
  return {
    deck: domain.deck,
    handle: async (request: Request) => closed ? new Response("Deck closed", { status: 503 }) : router(request),
    close: () => { closed = true; return domain.close() },
    tools: toEffectTools(operations),
  }
}
