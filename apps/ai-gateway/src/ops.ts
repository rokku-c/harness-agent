/**
 * The gateway's model plane, declared once.
 *
 * The console reads a gateway and an agent operates one, so every declaration
 * below is served twice - as an MCP tool and as an HTTP route - from this one
 * list, and neither surface can answer differently from the other. What the
 * gateway proxies (`/v1/*`) is request traffic rather than a move an operator
 * makes, so it keeps its own route and is not part of this list.
 */
import { OperationFault, noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { GatewayEvent } from "@effect-agent/ai-gateway"
import { gatewayConfig } from "./config.ts"
import { modelsState } from "./models-state.ts"
import { modelsUsage } from "./models-usage.ts"
import { checkProvider } from "./provider-health.ts"
import type { GatewayProvider } from "./providers.ts"
import type { HttpSend } from "./upstream.ts"

/** What these operations read: the live config, the platform egress, and the recorded audit. */
export interface AiGatewayModelSurfaces {
  readonly getConfig: () => unknown
  readonly send: HttpSend
  /** The audit oldest first; the recorder owns the store, these operations only read it. */
  readonly events: () => Promise<readonly GatewayEvent[]>
}

/** An id the live config does not carry is the caller's mistake, and the answer says which id. */
const providerOf = (surfaces: AiGatewayModelSurfaces, providerId: string): GatewayProvider => {
  const provider = (gatewayConfig(surfaces.getConfig()).providers ?? []).find((item) => item.id === providerId)
  if (provider === undefined) throw new OperationFault(404, `provider not found: ${providerId}`)
  return provider
}

export const aiGatewayOperations = (surfaces: AiGatewayModelSurfaces): readonly Operation[] => [
  operation({
    name: "ai_gateway_models",
    description: "The gateway's providers, rules, proxied endpoints and what it has carried; a credential is reported as configured or missing, never as its value",
    access: "read", input: noInput, http: { method: "GET", path: "/models" },
    handler: async () => ({ ...modelsState(surfaces.getConfig), usage: modelsUsage(await surfaces.events()) }),
  }),
  operation({
    name: "ai_gateway_events",
    description: "The fifty most recent gateway audit events, newest first: each request or response the proxy recorded, with the agent, status and duration it carried",
    access: "read", input: noInput, http: { method: "GET", path: "/models/events" },
    handler: async () => ({ ok: true, events: (await surfaces.events()).slice(-50).reverse() }),
  }),
  operation({
    name: "ai_gateway_test_provider",
    description: "Probe one configured provider by its id through the same platform egress the proxy uses, and report whether it answered, with what status, and how long it took",
    access: "write",
    input: z.object({ providerId: z.string().min(1) }).strict(),
    http: { method: "POST", path: "/models/providers/:providerId/test" },
    handler: async (input) => ({ ok: true, health: await checkProvider(providerOf(surfaces, input.providerId), surfaces.send) }),
  }),
]
