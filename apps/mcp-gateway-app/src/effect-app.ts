import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpGatewayPlugin } from "./effect-plugin.ts"
export const effectApp = defineApp({
  id: "mcp-gateway", title: "MCP Gateway", description: "MCP servers, mcpsets and bindings", path: "/mcp-gateway",
  icon: "⇄", color: "cyan",
  egress: "main-first", config: effectConfig, ui: effectUiView,
  // The mcp-registry app's plugin is what registers configured servers into the
  // shared registry; a gateway without it would serve a topology that is empty
  // for a reason the operator cannot see.
  requires: ["mcp-registry"],
  createPlugin: (getConfig, context) => createMcpGatewayPlugin(getConfig, context),
})
