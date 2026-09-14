import { createUiHostPlugin } from "./effect-plugin.ts"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { defineApp } from "@effect-agent/effect-apps"

export const effectApp = defineApp({
  id: "ui-host",
  title: "UI Canvas",
  description: "ui runtime host console",
  path: "/ui",
  icon: "Browsers", color: "iris",
  egress: "main-first",
  config: effectConfig,
  ui: effectUiView,
  createPlugin: createUiHostPlugin,
})
