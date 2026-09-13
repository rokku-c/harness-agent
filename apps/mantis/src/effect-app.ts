/**
 * Standard app form for mantis (declarative facade).
 * The DingTalk worker itself keeps running independently; this descriptor only
 * exposes mantis' configSchema + declarative UI into the platform.
 */

import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { createMantisPlugin } from "./effect-plugin.ts"
import { defineApp } from "@effect-agent/effect-apps"

export const effectApp = defineApp({
  id: "mantis",
  title: "Mantis",
  description: "Human-agent conversations, workspace records, memory, and approvals",
  path: "/mantis",
  icon: "◉", color: "crimson",
  config: effectConfig,
  ui: effectUiView,
  createPlugin: (getConfig) => createMantisPlugin(getConfig),
})
