import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMcpRegistryPlugin } from "./effect-plugin.ts"

export const effectApp = defineApp({
  id: "mcp-registry", title: "MCP Registry", description: "MCP server lease registry", path: "/mcp-registry",
  icon: "◇", color: "sky",
  routes: [{ path: "/mcp-registry", match: "prefix" }, { path: "/-/registry", match: "prefix" }],
  egress: "main-first", config: effectConfig, ui: effectUiView,
  createPlugin: (getConfig, context) => createMcpRegistryPlugin(getConfig, context),
})
