import type { EffectAppDescriptor } from "@effect-agent/effect-apps"
import { makeAiGatewayEffectPlugin } from "./effect-plugin.ts"
import { effectConfig } from "./effect-config.ts"
import { gatewayRoutes } from "./routes.ts"

export const effectApp: EffectAppDescriptor = {
  id: "ai-gateway",
  title: "ai-gateway",
  description: "Model proxy (OpenAI Chat / Responses / Anthropic Messages)",
  config: effectConfig,
  egress: "main-first",
  routes: gatewayRoutes,
  createPlugin: (getConfig, context) => makeAiGatewayEffectPlugin({ getConfig, send: context.fetch }),
}
