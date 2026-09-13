/**
 * agentd's inbound path: the operation list first, then the tunnel.
 *
 * The tunnel is a passthrough of everything under its own prefix — any method,
 * any body — so it is a route rather than an operation, and the one surface here
 * that has no tool beside it. An operation that does not match and a tunnel that
 * does not claim the path leave one answer: not found.
 */
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
