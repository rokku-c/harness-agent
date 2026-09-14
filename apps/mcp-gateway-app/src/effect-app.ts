import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpGatewayPlugin } from "./effect-plugin.ts"
export const effectApp = defineApp({
  id: "mcp-gateway", title: "MCP Gateway", description: "The one door agents reach MCP servers through", path: "/mcp-gateway",
  icon: "Plugs", color: "cyan",
  egress: "main-first", config: effectConfig, ui: effectUiView,
  // Two apps, two different reasons. The mcp-registry app's plugin is what
  // registers configured servers into the shared registry; a gateway without it
  // would serve a topology that is empty for a reason the operator cannot see.
  // Agentd is where a set and a binding are declared, so a gateway without it
  // enforces nothing and refuses every identified call — a door with no lists.
  requires: ["mcp-registry", "agentd"],
  createPlugin: (getConfig, context) => createMcpGatewayPlugin(getConfig, context),
})
