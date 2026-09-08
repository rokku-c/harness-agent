/** Embedded Deck owns a handler and SQLite, never a listener. */
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import { effectConfig } from "./effect-config.ts"
import { createDeckApp, type DeckOptions } from "./app.ts"

type DeckApp = { handle(request: Request): Promise<Response>; close(): void | Promise<void> }
type MakeDeck = (options: DeckOptions) => DeckApp
export const createDeckPlugin = (
  getConfig: () => unknown, _context: AppRuntimeContext, make: MakeDeck = createDeckApp,
): EffectPlugin => ({
  id: "deckconsole",
  priority: 40,
  load: async () => {
    const { configFile } = effectConfig.schema.parse(getConfig())
    const app = make({ configFile, basePath: "/deck" })
    return {
      handle: async (request) => {
        const inner = rewriteRequest(request, "/deck")
        return inner ? app.handle(inner) : new Response("Not Found", { status: 404 })
      },
      stop: () => app.close(),
    }
  },
})
