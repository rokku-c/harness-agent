export type McpGatewayEventType = "call" | "authz" | "rule" | "response" | "error"
export type RuleDecision = "allow" | "deny" | "log"

export interface McpGatewayEvent {
  readonly callId: string
  readonly type: McpGatewayEventType
  readonly at: number
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

export interface McpGatewayRecorder { record(event: McpGatewayEvent): void | Promise<void> }
