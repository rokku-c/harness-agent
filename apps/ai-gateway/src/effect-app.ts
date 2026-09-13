import { defineApp } from "@effect-agent/effect-apps"
import { makeAiGatewayEffectPlugin } from "./effect-plugin.ts"
import { effectConfig } from "./effect-config.ts"
import { effectUiView } from "./effect-ui.ts"
import { gatewayRoutes } from "./routes.ts"

export const effectApp = defineApp({
  id: "ai-gateway",
  title: "AI Gateway",
  description: "Model proxy (OpenAI Chat / Responses / Anthropic Messages)",
  path: "/models",
  icon: "✦", color: "amber",
  config: effectConfig,
  ui: effectUiView,
  egress: "main-first",
  routes: gatewayRoutes,
  createPlugin: (getConfig, context) => makeAiGatewayEffectPlugin({ getConfig, send: context.fetch }),
})
