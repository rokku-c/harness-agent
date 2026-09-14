import type { Authz, Principal } from "@effect-agent/effect-authz"

import type { McpGatewayEvent, McpGatewayRecorder, RuleDecision } from "./contract-audit.ts"
import type { McpGatewayRule } from "./rules.ts"
import type { McpGatewayServer, McpSetReader } from "./contract-sets.ts"

export interface McpGatewayContext {
  readonly callId: string
  readonly principal?: Principal
  readonly session?: string
  readonly requestId?: string
  readonly setId?: string
  readonly serverId?: string
  readonly tool?: string
  readonly args?: Readonly<Record<string, unknown>>
}

export interface McpServerResolver { resolve(context: McpGatewayContext): Promise<McpGatewayServer | undefined> }

export interface McpUpstream {
  call(call: { readonly serverId: string; readonly tool: string; readonly args?: Readonly<Record<string, unknown>> }): Promise<{
    readonly status: number; readonly ok: boolean; readonly detail?: string; readonly durationMs: number
  }>
}

export interface McpGatewayOptions {
  readonly rules?: readonly McpGatewayRule[]
  readonly recorder?: McpGatewayRecorder
  readonly resolver?: McpServerResolver
  readonly setRegistry?: McpSetReader
  readonly authz?: Authz
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

export type McpGatewayVerdict =
  | {
      readonly allowed: true
      readonly decision: RuleDecision
      readonly ruleId?: string
      readonly serverId: string
      readonly setId?: string
      readonly trace: readonly McpGatewayEvent[]
    }
  | {
      readonly allowed: false
      readonly status: number
      readonly detail: string
      readonly decision: RuleDecision
      readonly ruleId?: string
      readonly serverId?: string
      readonly setId?: string
      readonly trace: readonly McpGatewayEvent[]
    }

export interface McpGateway {
  decide(context: McpGatewayContext): Promise<McpGatewayVerdict>
  handle(context: McpGatewayContext): Promise<McpGatewayResult>
}
