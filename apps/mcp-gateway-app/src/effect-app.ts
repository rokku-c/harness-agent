import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpGatewayPlugin } from "./effect-plugin.ts"
export const effectApp: EffectAppDescriptor = {
  id: "mcp-gateway", title: "MCP Gateway", description: "MCP servers, mcpsets and bindings", path: "/mcp-gateway",
  routes: [{ path: "/mcp-gateway", match: "prefix" }], egress: "main-first", config: effectConfig, ui: effectUiView,
  createPlugin: (getConfig, context) => createMcpGatewayPlugin(getConfig, context),
}
