import type { EffectPlugin } from "@effect-agent/effect-host"
import { toEffectTools, toHttpHandler } from "@effect-agent/effect-interface"
import { herdrSettings } from "./effect-config.ts"
import { makeHerdrClient } from "./herdr-client.ts"
import { herdrOperations, type HerdrSurfaces } from "./ops/index.ts"

const notFound = (): Response => Response.json({ ok: false, error: "Not found" }, { status: 404 })

export const createHerdrPlugin = (getConfig: () => unknown): EffectPlugin => ({
  id: "herdr", priority: 20,
  load: async () => {
    const settings = herdrSettings(getConfig)
    const surfaces: HerdrSurfaces = {
      client: makeHerdrClient(settings),
      socketPath: settings.socketPath,
    }
    const operations = herdrOperations(surfaces)
    const console = toHttpHandler(operations)
    return {
      tools: toEffectTools(operations),
      handle: async (request) => (await console(request)) ?? notFound(),
    }
  },
})
