import { defineApp } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createBoardPlugin } from "./effect/plugin.ts"

export const effectApp = defineApp({
  id: "board", title: "Board", description: "Task board: data, hierarchy and events", path: "/board/",
  icon: "▦", color: "grass",
  egress: "local-only",
  config: effectConfig, ui: effectUiView, createPlugin: createBoardPlugin,
})
