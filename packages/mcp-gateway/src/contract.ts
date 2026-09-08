/** MCP gateway contracts: routing, policy, proxying, and audit. */
export type McpGatewayEventType = "call" | "rule" | "response" | "error"
export type RuleDecision = "allow" | "deny" | "log"

export interface McpGatewayContext {
  readonly callId: string
  readonly agent?: string
  readonly session?: string
  readonly requestId?: string
  readonly setId?: string
  readonly serverId?: string
  readonly tool?: string
  readonly args?: Readonly<Record<string, unknown>>
}

export interface McpGatewayEvent {
  readonly callId: string
  readonly type: McpGatewayEventType
  readonly at: number
  readonly agent?: string
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

export interface McpGatewayRule {
  readonly ruleId: string
  readonly match?: { readonly agent?: string; readonly session?: string; readonly serverId?: string; readonly tool?: string }
  readonly action: RuleDecision
}
export interface McpGatewayRecorder { record(event: McpGatewayEvent): void | Promise<void> }
export interface McpGatewayServer { readonly serverId: string; readonly name?: string; readonly era?: string; readonly transport?: "streamable-http" | "stdio"; readonly endpoint?: string; readonly headers?: Readonly<Record<string, string>> }
export interface McpSet { readonly setId: string; readonly name?: string; readonly servers: readonly string[]; readonly allowTools?: readonly string[]; readonly denyTools?: readonly string[] }
export interface McpSetBinding { readonly agentId: string; readonly setIds: readonly string[] }
export interface McpSetResolution extends McpGatewayServer { readonly setId: string; readonly allowed: boolean }
export interface McpSetRegistry {
  registerServer(server: McpGatewayServer): void
  registerSet(set: McpSet): void
  bindAgent(binding: McpSetBinding): void
  resolve(agent: string | undefined, setId: string | undefined, tool: string): McpSetResolution | undefined
}
export interface McpServerResolver { resolve(context: McpGatewayContext): Promise<McpGatewayServer | undefined> }
export type McpServerSource = McpGatewayServer & { readonly transport: "streamable-http" | "stdio"; readonly endpoint: string; readonly headers?: Readonly<Record<string, string>> }
export interface McpUpstream {
  call(call: { readonly serverId: string; readonly tool: string; readonly args?: Readonly<Record<string, unknown>> }): Promise<{
    readonly status: number; readonly ok: boolean; readonly detail?: string; readonly durationMs: number
  }>
}
export interface McpGatewayOptions {
  readonly rules?: readonly McpGatewayRule[]
  readonly recorder?: McpGatewayRecorder
  readonly resolver?: McpServerResolver
  readonly setRegistry?: McpSetRegistry
  readonly upstream: McpUpstream
  readonly defaultAction?: RuleDecision
  readonly captureArgs?: boolean
}
export interface McpGatewayResult {
  readonly ok: boolean
  readonly status: number
  readonly serverId?: string
  readonly setId?: string
  readonly decision: RuleDecision
  readonly ruleId?: string
  readonly detail?: string
  readonly durationMs?: number
}
