import { makeDeckDomain } from "./domain/deck.ts"
import { makeRouter } from "./http/router.ts"
import type { DeckOptions } from "./domain/options.ts"

export type { DeckOptions } from "./domain/options.ts"
/** Owns state and SQLite, never a socket. Every load creates an independent app. */
export const createDeckApp = (options: DeckOptions = {}) => {
  const domain = makeDeckDomain(options)
  const router = makeRouter(domain, options.basePath ?? "")
  let closed = false
  return {
    deck: domain.deck,
    handle: async (request: Request) => closed ? new Response("Deck closed", { status: 503 }) : router(request),
    close: () => { closed = true; return domain.close() },
  }
}
