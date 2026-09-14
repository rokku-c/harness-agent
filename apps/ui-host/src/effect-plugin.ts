import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { rewriteRequest, type EffectPlugin } from "@effect-agent/effect-host"
import { effectConfig } from "./effect-config.ts"
import { makeWebHandler, type WebHandlerOptions } from "./web.ts"

type WebApp = { handle(request: Request): Promise<Response>; tools?: readonly unknown[]; close(): void | Promise<void> }
type MakeWeb = (options: WebHandlerOptions) => WebApp
export const createUiHostPlugin = (
  getConfig: () => unknown, _context: AppRuntimeContext, make: MakeWeb = makeWebHandler,
): EffectPlugin => ({
  id: "ui-host",
  priority: 30,
  load: async () => {
    const { theme, databaseFile } = effectConfig.schema.parse(getConfig())
    const app = make({ theme, databaseFile })
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
