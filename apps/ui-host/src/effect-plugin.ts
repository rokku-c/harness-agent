/** Embedded UI owns a handler and SQLite, never a listener. */
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import { effectConfig } from "./effect-config.ts"
import { makeWebHandler, type WebHandlerOptions } from "./web.ts"

/**
 * `tools` is optional because `make` is replaceable: a host that swaps in its
 * own handler has whatever surface that handler declares, and none is a legal
 * answer. The app's own handler carries the operations' tools through.
 */
type WebApp = { handle(request: Request): Promise<Response>; tools?: readonly unknown[]; close(): void | Promise<void> }
type MakeWeb = (options: WebHandlerOptions) => WebApp
export const createUiHostPlugin = (
  getConfig: () => unknown, _context: AppRuntimeContext, make: MakeWeb = makeWebHandler,
): EffectPlugin => ({
  id: "ui-host",
  priority: 30,
  load: async () => {
    const { theme, renderer, databaseFile } = effectConfig.schema.parse(getConfig())
    const app = make({ theme, renderer, databaseFile, basePath: "/ui" })
    return {
      ...(app.tools === undefined ? {} : { tools: app.tools }),
      handle: async (request) => {
        const inner = rewriteRequest(request, "/ui")
        return inner ? app.handle(inner) : new Response("Not Found", { status: 404 })
      },
      stop: () => app.close(),
    }
  },
})
