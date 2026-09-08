import type { HostRoute } from "./plugin.ts"
import type { PluginLifecycle } from "./lifecycle.ts"
import { matchesHostRoute, matchesPlugin } from "./routes.ts"
import { controlRequest } from "./control.ts"
import { errorDetail, json } from "./response.ts"

export const dispatchRequest = async (
  request: Request, lifecycle: PluginLifecycle, routes: readonly HostRoute[], control: boolean,
): Promise<Response> => {
  const path = new URL(request.url).pathname
  if (control) {
    const response = await controlRequest(request, path, lifecycle)
    if (response !== undefined) return response
  }
  // Node routes retain precedence over loaded plugin planes.
  for (const route of routes) {
    if (!matchesHostRoute(route, request)) continue
    try { return await route.handle(request) } catch (error) {
      return json({ ok: false, detail: `route error: ${errorDetail(error)}` }, 502)
    }
  }
  for (const entry of lifecycle.ordered()) {
    if (!entry.enabled || entry.loaded === undefined) continue
    try {
      if (matchesPlugin(entry, request)) return await entry.loaded.handle(request)
    } catch (error) {
      return json({ ok: false, detail: `plugin ${entry.plugin.id} error: ${errorDetail(error)}` }, 502)
    }
  }
  return json({ ok: false, detail: "not found: " + path }, 404)
}
