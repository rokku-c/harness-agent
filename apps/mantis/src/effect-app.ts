import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMantisPlugin } from "./effect-plugin.ts"
import { defineApp } from "@effect-agent/effect-apps"

export const effectApp = defineApp({
  id: "mantis",
  title: "Mantis",
  description: "Human-agent conversations, workspace records, memory, and approvals",
  path: "/mantis",
  icon: "Chats", color: "crimson",
  config: effectConfig,
  ui: effectUiView,
  createPlugin: (getConfig) => createMantisPlugin(getConfig),
})
