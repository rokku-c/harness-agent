import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import { effectConfig } from "./effect-config.ts"
import { createBoardPlugin } from "./effect/plugin.ts"

export const effectApp: EffectAppDescriptor = {
  id: "board", title: "Board", description: "Task board: data, hierarchy and events", path: "/board/",
  routes: [{ path: "/board", match: "prefix" }], egress: "local-only",
  config: effectConfig, createPlugin: createBoardPlugin,
}
