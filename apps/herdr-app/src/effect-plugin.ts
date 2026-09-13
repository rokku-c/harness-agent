/**
 * Herdr's plane, loaded.
 *
 * One list of operations, projected twice: the tools an agent calls over MCP and
 * the routes this console reads are the same declarations, so a console that
 * says an agent is idle and an agent that reads it as blocked cannot both be
 * reporting Herdr — they are reading one answer through one client.
 *
 * The anonymous 404 is the fallback for a path this app does not serve rather
 * than a second routing table: the projection already returns nothing for a
 * request it does not claim, and inventing an answer there would be claiming a
 * path that belongs to whatever else the host serves.
 */
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
      // named in the workspaces answer, so the page can say which server it read
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
