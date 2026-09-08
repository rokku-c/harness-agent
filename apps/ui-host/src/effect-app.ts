/**
 * Standard app form for ui-host: one descriptor; engine derives lui/contract.
 */

import { createUiHostPlugin } from "./effect-plugin.ts"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { effectUiHtml } from "./effect-ui-html.ts"
import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

export const effectApp: EffectAppDescriptor = {
  id: "ui-host",
  title: "UI Canvas",
  description: "ui runtime host console",
  path: "/ui",
  routes: [{ path: "/ui", match: "prefix" }],
  egress: "main-first",
  config: effectConfig,
  ui: effectUiView,
  uiHtml: effectUiHtml,
  createPlugin: createUiHostPlugin,
}
