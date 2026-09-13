import type { EffectPlugin } from "@effect-agent/effect-host"
import type { GatewayEvent } from "@effect-agent/ai-gateway"
import { toEffectTools, toHttpHandler, type Operation } from "@effect-agent/effect-interface"
import { gatewayRoutes } from "./routes.ts"
import { makeAiGatewayHandler, type AiGatewayHandlerOptions } from "./handler.ts"
import type { HttpSend } from "./upstream.ts"
import { typeOrmRecorder, type StoredGatewayRecorder } from "./recorder.ts"
import { aiGatewayOperations, type AiGatewayModelSurfaces } from "./ops.ts"

export type { HttpSend } from "./upstream.ts"
/** The platform owns the recorder database path; app config never selects a local file. */
export type AiGatewayEffectOptions = AiGatewayHandlerOptions & { readonly send: HttpSend; readonly database?: string }

const DEFAULT_DATABASE = ".effect-agent/ai-gateway.sqlite"

/**
 * A write to a path this list only reads is a method error rather than the
 * proxy's business: the projection answers exactly the methods an operation
 * declares, so a POST to the model page would otherwise reach the gateway and
 * be answered 404 there, which is a different fact about a different question.
 */
const methodGuard = (operations: readonly Operation[]) => {
  const reads = operations.flatMap((op) => (op.http?.method === "GET" ? [op.http.path] : []))
  return (request: Request): Response | undefined =>
    reads.includes(new URL(request.url).pathname)
      ? new Response(null, { status: 405, headers: { allow: "GET" } })
      : undefined
}

export const makeAiGatewayEffectPlugin = (options: AiGatewayEffectOptions): EffectPlugin => {
  if (typeof options?.send !== "function") throw new Error("ai-gateway: platform egress send is required")
  return {
    id: "ai-gateway",
    priority: 10,
    routes: gatewayRoutes,
    load: async () => {
      const stored: StoredGatewayRecorder | undefined = options.recorder === undefined ? typeOrmRecorder(options.database ?? DEFAULT_DATABASE) : undefined
      const recorder = options.recorder ?? stored!
      const events = async (): Promise<readonly GatewayEvent[]> => stored?.events ? await stored.events() : []
      const handler = makeAiGatewayHandler({ ...options, recorder })
      const surfaces: AiGatewayModelSurfaces = { getConfig: () => options.getConfig?.() ?? {}, send: options.send, events }
      // one list, two projections: the tools an agent calls and the routes the
      // console reads are the same declarations, so they cannot drift apart
      const operations = aiGatewayOperations(surfaces)
      const console = toHttpHandler(operations)
      const notAllowed = methodGuard(operations)
      return {
        tools: toEffectTools(operations),
        handle: async (request) => (await console(request)) ?? notAllowed(request) ?? handler(request),
        stop: async () => { await stored?.close() },
      }
    },
  }
}
