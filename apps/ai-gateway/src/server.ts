import { makeAiGateway, type GatewayRecorder, type GatewayRule } from "@effect-agent/ai-gateway"
import { typeOrmRecorder } from "./recorder.ts"
import { httpUpstream } from "./upstream.ts"

export interface AiGatewayServerOptions {
  readonly port?: number
  readonly upstreamBase: string
  readonly apiKey?: string
  readonly database: string
  readonly recorder?: GatewayRecorder
  readonly captureBodies?: boolean
  readonly rules?: ReadonlyArray<GatewayRule>
  readonly send?: typeof fetch
}

const json = (value: unknown, status = 200) => Response.json(value, { status })

export const startAiGateway = (options: AiGatewayServerOptions) => {
  const gateway = makeAiGateway({
    upstream: httpUpstream(options.upstreamBase, options.apiKey, options.send),
    recorder: options.recorder ?? typeOrmRecorder(options.database),
    captureBodies: options.captureBodies,
    rules: options.rules
  })
  return Bun.serve({
    port: options.port ?? 4890,
    fetch: async (request) => {
      const url = new URL(request.url)
      if (url.pathname === "/health") return json({ ok: true })
      if (request.method !== "POST" || !url.pathname.startsWith("/v1/")) return new Response("Not Found", { status: 404 })
      const context = {
        requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
        agent: request.headers.get("x-agent-id") ?? undefined,
        session: request.headers.get("x-session-id") ?? undefined,
        path: url.pathname
      }
      try { return await gateway.handle(request, context) }
      catch (cause) { return json({ error: { message: cause instanceof Error ? cause.message : String(cause), type: "gateway_error" } }, 502) }
    }
  })
}
