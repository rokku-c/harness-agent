import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpRegistryPlugin } from "./effect-plugin.ts"

export const effectApp: EffectAppDescriptor = {
  id: "mcp-registry", title: "MCP Registry", description: "MCP server lease registry", path: "/mcp-registry",
  routes: [{ path: "/mcp-registry", match: "prefix" }, { path: "/-/registry", match: "prefix" }],
  config: effectConfig, ui: effectUiView,
  createPlugin: (getConfig, context) => createMcpRegistryPlugin(getConfig, context.mcpRegistry!),
}
