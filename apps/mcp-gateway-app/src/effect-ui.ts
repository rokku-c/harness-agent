/**
 * The gateway console: who may reach which server, and why.
 *
 * The preview sits first, because asking whether one agent may reach one tool
 * is what an operator comes here to do; the topology below it is what they read
 * to understand the answer. Each list is built by `listCard`, which gives a
 * table the emptiness of its own list; whether the read behind it is running or
 * failed belongs to the source, and the section that owns the source says it
 * once, above every list that read feeds.
 */

import type { EffectUiView } from "@effect-agent/effect-ui"
import { region } from "@effect-agent/effect-ui"
import { accessSection } from "./effect-ui-access.ts"
import { auditSection } from "./effect-ui-audit.ts"
import { heading, text } from "./effect-ui-nodes.ts"
import { topologySections } from "./effect-ui-topology.ts"

export const effectUiView: EffectUiView = {
  viewId: "mcp-gateway-console",
  title: "MCP Gateway",
  state: {
    gateway: { servers: [], sets: [], bindings: [] },
    audit: { events: [] },
    access: { agent: "", tool: "", result: undefined },
  },
  sources: [
    { id: "topology", url: "/mcp-gateway", state: "/gateway", refreshMs: 10000 },
    { id: "audit", url: "/mcp-gateway/audit", state: "/audit", refreshMs: 10000 },
  ],
  actions: [{ name: "gateway.access", method: "GET", url: "/mcp-gateway/access", result: "/access/result" }],
  nodes: [
    heading("MCP Gateway", { size: "6" }),
    text("One governed MCP entry point for every agent.", { size: "2", color: "gray" }),
    // The preview is the question, so it stays above the fold with its answer.
    // The topology and the audit trail are the evidence, and both grow.
    accessSection,
    region([...topologySections, auditSection]),
  ],
}
