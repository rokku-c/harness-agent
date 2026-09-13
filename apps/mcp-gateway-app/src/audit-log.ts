import type { McpGatewayEvent, McpGatewayRecorder } from "@effect-agent/mcp-gateway"

/** Bounded per-process audit; the gateway owns decisions, the host owns retention policy. */
export interface AuditLog extends McpGatewayRecorder {
  list(): readonly McpGatewayEvent[]
}
export const makeAuditLog = (limit = 200): AuditLog => {
  const events: McpGatewayEvent[] = []
  return {
    record: (event) => {
      events.push(event)
      if (events.length > limit) events.splice(0, events.length - limit)
    },
    list: () => [...events].reverse(),
  }
}
