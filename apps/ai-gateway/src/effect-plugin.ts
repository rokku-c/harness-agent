import type { EffectPlugin } from "@effect-agent/effect-host"
import { gatewayRoutes } from "./routes.ts"
import { makeAiGatewayHandler, type AiGatewayHandlerOptions } from "./handler.ts"
import type { HttpSend } from "./upstream.ts"

export type { HttpSend } from "./upstream.ts"
export type AiGatewayEffectOptions = AiGatewayHandlerOptions & { readonly send: HttpSend }

export const makeAiGatewayEffectPlugin = (options: AiGatewayEffectOptions): EffectPlugin => {
  if (typeof options?.send !== "function") throw new Error("ai-gateway: platform egress send is required")
  return {
    id: "ai-gateway",
    priority: 10,
    routes: gatewayRoutes,
    load: async () => ({ handle: makeAiGatewayHandler(options) }),
  }
}
