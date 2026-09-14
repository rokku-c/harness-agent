import type { GatewayEvent } from "@effect-agent/ai-gateway"

export const USAGE_WINDOW = 500

export interface ModelsUsageExchange {
  readonly at: number
  readonly requestId: string
  readonly agent?: string
  readonly status?: number
  readonly durationMs?: number
  readonly error?: string
}
export interface ModelsUsage {
  readonly requests: number
  readonly responses: number
  readonly errors: number
  readonly averageDurationMs: number | null
  readonly recent: readonly ModelsUsageExchange[]
}

const exchanges = (events: readonly GatewayEvent[]): ModelsUsageExchange[] => {
  const byId = new Map<string, ModelsUsageExchange>()
  for (const event of events) {
    const open = byId.get(event.requestId) ?? { at: event.at, requestId: event.requestId }
    const detail = event.detail
    byId.set(event.requestId, {
      ...open,
      ...(event.agent === undefined ? {} : { agent: event.agent }),
      ...(typeof detail.status === "number" ? { status: detail.status } : {}),
      ...(typeof detail.durationMs === "number" ? { durationMs: Math.round(detail.durationMs) } : {}),
      ...(event.type === "error" ? { error: String(detail.message ?? "failed") } : {}),
    })
  }
  return [...byId.values()]
}

export const modelsUsage = (events: readonly GatewayEvent[]): ModelsUsage => {
  const all = exchanges(events)
  const durations = all.map((exchange) => exchange.durationMs).filter((value): value is number => value !== undefined)
  return {
    requests: events.filter((event) => event.type === "request").length,
    responses: events.filter((event) => event.type === "response").length,
    errors: events.filter((event) => event.type === "error").length,
    averageDurationMs: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
    recent: all.slice(-20).reverse(),
  }
}
