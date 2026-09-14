import type { RoutePattern } from "@effect-agent/effect-host"

export const gatewayRoutes: readonly RoutePattern[] = [
  { path: "/health", match: "exact" },
  { path: "/models", match: "prefix" },
  { path: "/v1", match: "prefix" },
]
