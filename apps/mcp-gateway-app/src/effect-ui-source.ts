import type { UiSourceSpec } from "@effect-agent/effect-ui"
import { AUDIT, DIRECTORY, EVENTS, GATEWAY, IDENTITIES, TOPOLOGY } from "./effect-ui-paths.ts"

export const gatewaySources: readonly UiSourceSpec[] = [
  { id: TOPOLOGY, url: "/mcp-gateway", state: GATEWAY, refreshMs: 10000 },
  { id: AUDIT, url: "/mcp-gateway/audit", state: EVENTS, refreshMs: 10000 },
  { id: IDENTITIES, url: "/mcp-gateway/identities", state: DIRECTORY, refreshMs: 10000 },
]
