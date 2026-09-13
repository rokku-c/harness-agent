/**
 * MCP gateway contracts: one call, and the engine that answers it.
 *
 * A context is everything known about a call when it is asked about, and a
 * principal is the only part of it that is an identity — the session and the
 * request id are correlation, carried so a log can be followed and never used to
 * decide anything.
 *
 * What can be reached is `contract-sets.ts`; what a call leaves behind is
 * `contract-audit.ts`.
 */
import type { Authz, Principal } from "@effect-agent/effect-authz"

import type { McpGatewayEvent, McpGatewayRecorder, RuleDecision } from "./contract-audit.ts"
import type { McpGatewayRule } from "./rules.ts"
import type { McpGatewayServer, McpSetReader } from "./contract-sets.ts"

export interface McpGatewayContext {
  readonly callId: string
  /** The caller the door verified. Every decision about this call is made from it. */
  readonly principal?: Principal
  /** Correlation only — a hint from the request, never an identity. */
  readonly session?: string
  readonly requestId?: string
  readonly setId?: string
  readonly serverId?: string
  readonly tool?: string
  readonly args?: Readonly<Record<string, unknown>>
}

/** Where a server for a call comes from, when it is not the topology that says so. */
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
  /** What a call may reach. A reader, not a registry: the door enforces sets, it does not declare them. */
  readonly setRegistry?: McpSetReader
  /**
   * Per-principal enforcement. Absent means the gateway runs unguarded, which
   * is the pre-convergence posture; the external door must set it.
   */
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

/**
 * What the engine concluded about a call, and the audit trail it produced.
 *
 * Reading a verdict records nothing: a caller that only wants to know — the
 * advertised surface — takes `allowed` and drops `trace`, and a caller that
 * acts records it and then makes the call. That is what keeps a tool the door
 * advertises and a tool the door carries the same one answer. An allowed
 * verdict names the server, because a call that may happen must say where.
 */
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
  /** The decision a call would get, without making it. */
  decide(context: McpGatewayContext): Promise<McpGatewayVerdict>
  handle(context: McpGatewayContext): Promise<McpGatewayResult>
}
