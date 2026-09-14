import type { UiActionSpec } from "@effect-agent/effect-ui"
import { AGENTS_SOURCE, WORKSPACES_SOURCE, draft, keySeq, navTarget, outcome } from "./effect-ui-nodes.ts"
import { FLEET_URL, SCROLLBACK_LINES, WORKSPACES_URL } from "./effect-ui-reads.ts"

export const herdrActions = [
  { name: "herdr.openStart", opens: "start" },
  { name: "herdr.openWorkspaces", opens: "workspaces" },
  { name: "herdr.openAgent", opens: "agent" },

  { name: "herdr.readFleet", method: "GET", url: FLEET_URL, refresh: [AGENTS_SOURCE] },
  { name: "herdr.readWorkspaces", method: "GET", url: WORKSPACES_URL, refresh: [WORKSPACES_SOURCE] },

  { name: "herdr.agentOutput", method: "GET", url: "/herdr/agents/{target}/output",
    params: { target: { state: navTarget }, source: "recent", lines: SCROLLBACK_LINES },
    result: outcome("herdr.agentOutput") },

  { name: "herdr.agentPrompt", method: "POST", url: "/herdr/agents/{target}/prompt",
    params: { target: { state: navTarget }, text: { state: draft("message") } },
    result: outcome("herdr.agentPrompt"), clear: [draft("message")], refresh: [AGENTS_SOURCE] },

  { name: "herdr.agentStart", method: "POST", url: "/herdr/agents",
    params: { name: { state: draft("startName") }, kind: { state: draft("startKind") },
      workspaceId: { state: draft("startWorkspace") } },
    result: outcome("herdr.agentStart"), refresh: [AGENTS_SOURCE, WORKSPACES_SOURCE] },

  { name: "herdr.agentFocus", method: "POST", url: "/herdr/agents/{target}/focus",
    params: { target: { state: navTarget } }, result: outcome("herdr.agentFocus"),
    refresh: [AGENTS_SOURCE, WORKSPACES_SOURCE] },

  { name: "herdr.agentEscape", method: "POST", url: "/herdr/agents/{target}/keys",
    params: { target: { state: navTarget }, keys: { state: keySeq("escape") } },
    result: outcome("herdr.agentEscape"), refresh: [AGENTS_SOURCE] },
  { name: "herdr.agentInterrupt", method: "POST", url: "/herdr/agents/{target}/keys",
    params: { target: { state: navTarget }, keys: { state: keySeq("interrupt") } },
    result: outcome("herdr.agentInterrupt"), refresh: [AGENTS_SOURCE] },
] as const satisfies readonly UiActionSpec[]

export type HerdrAction = (typeof herdrActions)[number]["name"]
