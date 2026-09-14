export type LaunchState = "queued" | "claimed" | "running" | "done" | "failed" | "cancelled"

export interface AgentTurn {
  readonly nodeId?: string
  readonly agentId: string
  readonly workdir: string
  readonly prompt: string
}

export interface CommandWork {
  readonly machineId: string
  readonly workdir: string
  readonly command: string
  readonly args?: readonly string[]
}

export interface QueuedTurn extends AgentTurn {
  readonly machineId: string
  readonly kind: string
}

export type QueuedWork = QueuedTurn | CommandWork

export type LaunchIntent = QueuedWork & {
  readonly intentId: string
  readonly state: LaunchState
  readonly createdAt: number
  readonly claimedAt?: number
  readonly settledAt?: number
  readonly detail?: string
}
