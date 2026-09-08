import type { GatewayContext, GatewayEvent, GatewayRecorder, GatewayRule, GatewayUpstream } from "./contract.ts"
import { injectOpenAi } from "./injection.ts"
import { digestText, redact, safeHeaders } from "./redaction.ts"
import { matchingRules } from "./rules.ts"

export interface GatewayOptions {
  readonly upstream: GatewayUpstream
  readonly recorder?: GatewayRecorder
  readonly rules?: ReadonlyArray<GatewayRule>
  readonly captureBodies?: boolean
}

const event = (context: GatewayContext, type: GatewayEvent["type"], detail: Record<string, unknown>): GatewayEvent =>
  ({ requestId: context.requestId, type, at: Date.now(), agent: context.agent, session: context.session, detail })

export const makeAiGateway = (options: GatewayOptions) => ({
  handle: async (request: Request, context: GatewayContext): Promise<Response> => {
    const started = performance.now()
    try {
      const inspect = options.captureBodies || (context.path === "/v1/chat/completions" && options.rules?.length)
      const body = inspect ? await request.clone().json() as Record<string, unknown> : undefined
      const rules = context.path === "/v1/chat/completions" ? matchingRules(options.rules ?? [], {
        ...context, model: typeof body?.model === "string" ? body.model : context.model,
      }) : []
      const controlled = body ? injectOpenAi(body, rules) : body
      await options.recorder?.record(event(context, "request", { headers: safeHeaders(request.headers), body: options.captureBodies ? redact(body) : undefined }))
      for (const rule of controlled !== body ? rules : []) await options.recorder?.record(event(context, "injection", {
        ruleId: rule.ruleId,
        position: rule.inject.position ?? "system-prefix",
        contentDigest: await digestText(rule.inject.content)
      }))
      const upstream = controlled === body ? request : new Request(request, { body: JSON.stringify(controlled) })
      const response = await options.upstream.send(upstream)
      await options.recorder?.record(event(context, "response", { status: response.status, durationMs: performance.now() - started }))
      return response
    } catch (cause) {
      await options.recorder?.record(event(context, "error", { message: cause instanceof Error ? cause.message : String(cause) }))
      throw cause
    }
  }
})
