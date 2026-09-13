/**
 * mcp-gateway — what a call leaves behind.
 *
 * An event is the unit of the trail: one thing that happened to one call, at one
 * time, with the identity it happened to. The identity is a *key* rather than a
 * principal because the trail outlives the request that produced it and is read
 * as a column — `user:alice` groups, and an object does not.
 *
 * `RuleDecision` is stated here rather than beside the rules because the word is
 * what the record says: a rule's action, an option's fallback, and a verdict all
 * end up in `decision` on an event, and one spelling of the three words is what
 * keeps a decision readable back out of the log that recorded it.
 */
export type McpGatewayEventType = "call" | "authz" | "rule" | "response" | "error"
export type RuleDecision = "allow" | "deny" | "log"

export interface McpGatewayEvent {
  readonly callId: string
  readonly type: McpGatewayEventType
  readonly at: number
  /** Principal key, e.g. `user:alice` — the axis audit is grouped by. */
  readonly principal?: string
  readonly setId?: string
  readonly serverId?: string
  readonly tool?: string
  readonly ruleId?: string
  readonly decision?: RuleDecision
  readonly status?: number
  readonly durationMs?: number
  readonly argsRedacted?: Readonly<Record<string, unknown>>
  readonly detail?: string
}

/** Where a trail goes. The gateway produces events; nothing here keeps them. */
export interface McpGatewayRecorder { record(event: McpGatewayEvent): void | Promise<void> }
