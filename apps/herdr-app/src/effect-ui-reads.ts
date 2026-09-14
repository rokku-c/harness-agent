import type { UiNodeSpec } from "@effect-agent/effect-ui"

export const FLEET_TAIL = 12
export const SCROLLBACK_LINES = 200
export const AGENTS_REFRESH_MS = 5_000
export const WORKSPACES_REFRESH_MS = 30_000

export const FLEET_URL = `/herdr/agents?tail=${FLEET_TAIL}`
export const WORKSPACES_URL = "/herdr/workspaces"

export const terminal = (read: { readonly bind: string } | { readonly item: string }): UiNodeSpec =>
  ({ component: "Code", props: { size: "1", style: { whiteSpace: "pre-wrap", display: "block" } }, ...read })
