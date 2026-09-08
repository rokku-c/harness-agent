/**
 * Standard app form for mantis (declarative facade).
 * The DingTalk worker itself keeps running independently; this descriptor only
 * exposes mantis' configSchema + declarative UI into the platform.
 */

import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import type { EffectAppDescriptor } from "@effect-agent/effect-apps"

export const effectApp: EffectAppDescriptor = {
  id: "mantis",
  title: "Mantis",
  description: "DingTalk agent — declarative facade",
  config: effectConfig,
  ui: effectUiView,
}
