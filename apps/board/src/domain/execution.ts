import type { IsolationLevel } from "./agents.ts"

export type LaunchMode = "direct" | "override" | "isolated"
export type MergePolicy = "none" | "review" | "auto"
export type VerifyPolicy = "none" | "operator" | "schema"
export type ExecutionStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "orphan"

export interface RunPolicy {
  readonly verify?: VerifyPolicy
  readonly merge?: MergePolicy
}

export interface LaunchIntent {
  readonly nodeId: string
  readonly agentId: string
  readonly mode: LaunchMode
  readonly kind: string
  readonly config?: Readonly<Record<string, unknown>>
  readonly isolation?: IsolationLevel
  readonly runPolicy?: RunPolicy
  readonly prompt?: string
}

export interface ExecutionRecord {
  readonly runId: string
  readonly nodeId: string
  readonly agentId: string
  readonly channel: "mcp-self" | "probe" | "runtime"
  readonly mode: LaunchMode
  readonly status: ExecutionStatus
  readonly policy: RunPolicy
  readonly startedAt?: number
  readonly finishedAt?: number
  readonly result?: string
}

export const canRetry = (status: ExecutionStatus): boolean => status === "failed" || status === "orphan"
