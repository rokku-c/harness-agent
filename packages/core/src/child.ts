export type Trigger = { readonly kind: "progress" | "completed" }

export interface Watch {
  readonly when: Trigger
  readonly spawn: { readonly agent: string; readonly task: string }
}

export interface Spawned {
  readonly childId: string
  readonly agent: string
}

export type ChildStatus = "running" | "completed" | "failed" | "interrupted" | "paused"

export interface ChildResult {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
  readonly output?: unknown
  readonly error?: string
  readonly checkpointRef?: string
}

export interface ChildSummary {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
}
