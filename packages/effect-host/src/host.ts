/** Dependency-inverted plugin host: lifecycle ownership + request routing. */
import type { EffectPluginHost, HostRoute } from "./plugin.ts"
import { makePluginLifecycle } from "./lifecycle.ts"
import { dispatchRequest } from "./dispatch.ts"
import { matchesHostRoute, matchesPlugin } from "./routes.ts"

export interface HostOptions {
  /** Expose /-/planes control endpoints (list/enable/disable/remove). */
  readonly control?: boolean
}

export const makePluginHost = (options: HostOptions = {}): EffectPluginHost => {
  const lifecycle = makePluginLifecycle()
  const routes: HostRoute[] = []
  return {
    routes: () => lifecycle.ordered().filter((e) => e.enabled && e.loaded).flatMap((e) =>
      (e.plugin.routes ?? []).map((route) => ({ ...route, appId: e.plugin.id }))),
    resolveApp: (request) => {
      if (options.control && new URL(request.url).pathname.startsWith("/-/planes")) return "host-control"
      const route = routes.find((r) => matchesHostRoute(r, request))
      if (route) return route.appId
      return lifecycle.ordered().find((entry) => matchesPlugin(entry, request))?.plugin.id
    },
    list: lifecycle.list,
    register: lifecycle.register,
    unregister: lifecycle.unregister,
    enable: lifecycle.enable,
    disable: lifecycle.disable,
    isEnabled: lifecycle.isEnabled,
    close: lifecycle.close,
    registerRoute: (route: HostRoute) => {
      routes.push(route)
      let removed = false
      return () => {
        if (removed) return
        removed = true
        const index = routes.indexOf(route)
        if (index >= 0) routes.splice(index, 1)
      }
    },
    handle: (request) => dispatchRequest(request, lifecycle, routes, options.control === true),
  }
}
