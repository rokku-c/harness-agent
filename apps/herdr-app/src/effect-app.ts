import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createHerdrPlugin } from "./effect-plugin.ts"

export const effectApp = defineApp({
  id: "herdr", title: "Herdr", description: "Workspaces, agents and panes of a running Herdr server",
  path: "/herdr", icon: "GridFour", color: "cyan",
  config: effectConfig, ui: effectUiView,
  createPlugin: (getConfig) => createHerdrPlugin(getConfig),
})
