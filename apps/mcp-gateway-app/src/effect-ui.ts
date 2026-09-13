/**
 * The gateway console: who may reach which server, and why.
 *
 * The first screen is the question, and nothing else: an operator comes here to
 * ask whether one agent may reach one tool, and that answer is read in the card
 * they pressed in. The three things they read to understand or change the answer
 * are screens of their own — the identities the door can name, the topology
 * that decides, and the log of what it decided — reached from the doors under
 * the heading, so each gets the whole area it is read in and the question stays
 * beside it when the window is wide.
 *
 * The order of those doors is the order of a request's own journey: it is
 * identified, then authorized, and only then is anything carried and recorded.
 * An operator following a failure down the list finds the first thing that broke
 * rather than all of them.
 *
 * Each list is built by `listCard` or by the row builders, which give a list the
 * emptiness of its own; whether the read behind it is running or failed belongs
 * to the source, and the screen that owns the source says it once, above every
 * list that read feeds.
 */

import type { EffectUiView, UiActionSpec, UiNodeSpec } from "@effect-agent/effect-ui"
import { accessSection } from "./effect-ui-access.ts"
import { auditNodes } from "./effect-ui-audit.ts"
import { identityNodes } from "./effect-ui-identity.ts"
import { draft, heading, identitiesPath, identitiesSource, identitiesUrl, issueResult, press, principalResult, revokeResult, row, text } from "./effect-ui-nodes.ts"
import { topologyNodes } from "./effect-ui-topology.ts"

/** The three places the rest of the console is: named the way their own screens are named. */
const doors: UiNodeSpec = row([
  press("Identities", "gateway.openIdentities", undefined, { variant: "soft" }),
  press("Topology", "gateway.openTopology", undefined, { variant: "soft" }),
  press("Recent decisions", "gateway.openAudit", undefined, { variant: "soft" }),
])

/**
 * Every press the console can make. Issuing and revoking both settle the list
 * they were made from, so both re-read it: the answer a press writes stays where
 * it was written while the list beside it catches up.
 */
const actions: readonly UiActionSpec[] = [
  { name: "gateway.previewAccess", method: "GET", url: "/mcp-gateway/access", result: "/access/result" },
  {
    name: "gateway.issueToken", method: "POST", url: "/mcp-gateway/tokens", result: issueResult,
    params: {
      kind: { state: draft("kind") }, id: { state: draft("id") },
      displayName: { state: draft("name") }, ttlDays: { state: draft("days") },
    },
    clear: [draft("id")], refresh: [identitiesSource],
  },
  { name: "gateway.revokeToken", method: "POST", url: "/mcp-gateway/tokens/revoke", result: revokeResult, refresh: [identitiesSource] },
  { name: "gateway.setStatus", method: "POST", url: "/mcp-gateway/principals/status", result: principalResult, refresh: [identitiesSource] },
  // entering a screen is a behaviour like any other, and there is one way to say what a press does
  { name: "gateway.openIdentities", opens: "identities" },
  { name: "gateway.openTopology", opens: "topology" },
  { name: "gateway.openAudit", opens: "audit" },
]

export const effectUiView: EffectUiView = {
  viewId: "mcp-gateway-console",
  title: "MCP Gateway",
  state: {
    gateway: { servers: [], sets: [], bindings: [] },
    audit: { events: [] },
    identities: { principals: [], tokens: [] },
    access: { agent: "", tool: "", result: undefined },
    issue: { draft: { kind: "app", id: "", name: "", days: "" } },
  },
  sources: [
    { id: "topology", url: "/mcp-gateway", state: "/gateway", refreshMs: 10000 },
    { id: "audit", url: "/mcp-gateway/audit", state: "/audit", refreshMs: 10000 },
    { id: identitiesSource, url: identitiesUrl, state: identitiesPath, refreshMs: 10000 },
  ],
  actions,
  nodes: [
    heading("MCP Gateway", { size: "6" }),
    text("One governed MCP entry point for every agent.", { size: "2", color: "gray" }),
    doors,
    accessSection,
  ],
  screens: [
    { id: "identities", title: "Identities", nodes: identityNodes },
    { id: "topology", title: "Topology", nodes: topologyNodes },
    { id: "audit", title: "Recent decisions", nodes: auditNodes },
  ],
}
