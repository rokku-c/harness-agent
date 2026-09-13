/** Embedded Deck owns a handler and SQLite, never a listener. */
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import type { EffectTool } from "@effect-agent/effect-interface"
import { effectConfig } from "./effect-config.ts"
import { createDeckApp, type DeckOptions } from "./app.ts"

/** A deck app answers the requests it routes, and offers the operations it declared as tools. */
type DeckApp = { handle(request: Request): Promise<Response>; close(): void | Promise<void>; tools?: readonly EffectTool[] }
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
      tools: app.tools,
      handle: async (request) => {
        const inner = rewriteRequest(request, "/deck")
        return inner ? app.handle(inner) : new Response("Not Found", { status: 404 })
      },
      stop: () => app.close(),
    }
  },
})
