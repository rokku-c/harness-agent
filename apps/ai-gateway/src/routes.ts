import type { RoutePattern } from "@effect-agent/effect-host"

/** The SDK owns prefix boundaries and unregisters these with the app. */
export const gatewayRoutes: readonly RoutePattern[] = [
  { path: "/health", match: "exact" },
  { path: "/models", match: "prefix" },
  { path: "/v1", match: "prefix" },
]
