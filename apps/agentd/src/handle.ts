import { toHttpHandler } from "@effect-agent/effect-interface"
import { json } from "./http.ts"
import { agentdOperations } from "./ops/index.ts"
import type { AgentdSurfaces } from "./ops/surfaces.ts"
import { tunnelRoutes } from "./tunnel-routes.ts"

export const makeAgentdHandler = (surfaces: AgentdSurfaces) => {
  const operations = toHttpHandler(agentdOperations(surfaces))
  return async (request: Request): Promise<Response> => {
    const handled = await operations(request)
    if (handled !== undefined) return handled
    const forwarded = await tunnelRoutes(request, new URL(request.url), surfaces.tunnel)
    if (forwarded !== undefined) return forwarded
    return json({ ok: false, error: "not found" }, 404)
  }
}
