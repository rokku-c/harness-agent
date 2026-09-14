import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { createAgentdPlugin } from "./effect-plugin.ts"
import { effectUiView } from "./effect-ui.ts"
export const effectApp = defineApp({
  id: "agentd", title: "Agentd", description: "Machine and Agent configuration center", path: "/agentd",
  icon: "Robot", color: "gray",
  config: effectConfig, ui: effectUiView,
  egress: "main-first",
  createPlugin: (getConfig, context) => createAgentdPlugin(getConfig, { send: context.fetch, sets: context.mcpSets }),
})
