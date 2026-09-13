import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createHerdrPlugin } from "./effect-plugin.ts"

/**
 * The path is `/herdr` because the whole app is that prefix: the console, the
 * three reads it makes and every write behind a button are served under it by
 * one projection of one list of operations, so there is no second route table
 * to keep in step with the first.
 */
export const effectApp = defineApp({
  id: "herdr", title: "Herdr", description: "Workspaces, agents and panes of a running Herdr server",
  path: "/herdr", icon: "◱", color: "cyan",
  config: effectConfig, ui: effectUiView,
  createPlugin: (getConfig) => createHerdrPlugin(getConfig),
})
