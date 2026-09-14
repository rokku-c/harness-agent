import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpGatewayPlugin } from "./effect-plugin.ts"
export const effectApp = defineApp({
  id: "mcp-gateway", title: "MCP Gateway", description: "The one door agents reach MCP servers through", path: "/mcp-gateway",
  icon: "Plugs", color: "cyan",
  egress: "main-first", config: effectConfig, ui: effectUiView,
  requires: ["mcp-registry", "agentd"],
  createPlugin: (getConfig, context) => createMcpGatewayPlugin(getConfig, context),
})
