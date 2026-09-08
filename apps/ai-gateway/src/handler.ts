import { makeAiGateway, type GatewayRecorder, type GatewayRule } from "@effect-agent/ai-gateway"
import { gatewayConfig } from "./config.ts"
import { apiTypeForPath, type GatewayProvider } from "./providers.ts"
import { makeProviderSelector, ProviderSelectionError } from "./provider-selection.ts"
import { httpUpstream, type HttpSend } from "./upstream.ts"

export interface AiGatewayHandlerOptions {
  readonly getConfig?: () => unknown
  readonly send?: HttpSend
  readonly recorder?: GatewayRecorder
  readonly rules?: readonly GatewayRule[]
}
const error = (status: number, type: string, message: string) => Response.json({ error: { type, message } }, { status })
const message = (cause: unknown) => cause instanceof Error ? cause.message : String(cause)

export const makeAiGatewayHandler = (options: AiGatewayHandlerOptions = {}) => {
  const select = makeProviderSelector()
  return async (request: Request): Promise<Response> => {
    const path = new URL(request.url).pathname
    if (path === "/health") return Response.json({ ok: true })
    const apiType = apiTypeForPath(path)
    if (request.method !== "POST" || apiType === undefined) return new Response("Not Found", { status: 404 })
    let config: ReturnType<typeof gatewayConfig>
    try { config = gatewayConfig(options.getConfig?.()) }
    catch (cause) { return error(503, "config_error", `ai-gateway: invalid active config: ${message(cause)}`) }
    let provider: GatewayProvider | undefined
    try { provider = select(config.providers ?? [], apiType, request.headers.get("x-upstream-id")) }
    catch (cause) {
      if (cause instanceof ProviderSelectionError) return error(cause.status, cause.type, cause.message)
      throw cause
    }
    if (provider === undefined) return error(503, "provider_not_configured", `ai-gateway: no enabled provider configured for ${apiType} (${path})`)
    const gateway = makeAiGateway({
      upstream: httpUpstream(provider, options.send), recorder: options.recorder,
      captureBodies: config.captureBodies, rules: options.rules ?? config.rules,
    })
    const context = {
      requestId: request.headers.get("x-request-id") ?? crypto.randomUUID(),
      agent: request.headers.get("x-agent-id") ?? undefined,
      session: request.headers.get("x-session-id") ?? undefined,
      path,
    }
    try { return await gateway.handle(request, context) }
    catch (cause) { return error(502, "gateway_error", message(cause)) }
  }
}
