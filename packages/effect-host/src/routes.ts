import type { PluginEntry } from "./entry.ts"
import type { HostRoute } from "./plugin.ts"

export interface RoutePattern {
  readonly path: string
  readonly match?: "exact" | "prefix"
  readonly method?: string
}
export interface RegisteredRoute extends RoutePattern { readonly appId: string }
export const matchesRoute = (route: RoutePattern, request: Request): boolean => {
  if (route.method && route.method !== request.method) return false
  const path = new URL(request.url).pathname
  return route.match === "prefix"
    ? route.path === "/" || path === route.path || path.startsWith(route.path.replace(/\/$/, "") + "/")
    : path === route.path
}
export const matchesHostRoute = (route: HostRoute, request: Request): boolean =>
  matchesRoute({ ...route, path: route.path.replace(/\*$/, "").replace(/\/$/, "") || "/",
    match: route.path.endsWith("*") ? "prefix" : "exact" }, request)

export const matchesPlugin = (entry: PluginEntry, request: Request): boolean => {
  if (!entry.enabled || !entry.loaded) return false
  if (entry.plugin.routes) return entry.plugin.routes.some((route) => matchesRoute(route, request))
  return entry.loaded.canHandle?.(new URL(request.url).pathname) ?? false
}
export const validateRoutes = (routes: readonly RoutePattern[]): void => {
  for (const route of routes) {
    if (!route.path.startsWith("/") || /[?#*]/.test(route.path)) throw new Error(`Invalid route path: ${route.path}`)
    if (route.match && !["exact", "prefix"].includes(route.match)) throw new Error("Invalid route match")
  }
}
