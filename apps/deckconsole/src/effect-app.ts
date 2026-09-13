/**
 * Standard app form for deckconsole: one descriptor; engine derives lui.
 */

import { createDeckPlugin } from "./effect-plugin.ts"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { defineApp } from "@effect-agent/effect-apps"

export const effectApp = defineApp({
  id: "deckconsole",
  title: "Deck control room",
  description: "agent sessions + consent console",
  path: "/deck",
  icon: "⌘", color: "violet",
  egress: "main-first",
  config: effectConfig,
  ui: effectUiView,
  createPlugin: createDeckPlugin,
})
