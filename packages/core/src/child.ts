/**
 * Supervision vocabulary: pure data. The shapes a runtime (any runtime)
 * exposes when it can fork agents and talk to them while they run.
 */
export type Trigger = { readonly kind: "progress" | "completed" }

export interface Watch {
  readonly when: Trigger
  readonly spawn: { readonly agent: string; readonly task: string }
}

export interface Spawned {
  readonly childId: string
  readonly agent: string
}

export type ChildStatus = "running" | "completed" | "failed" | "interrupted"

export interface ChildResult {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
  readonly output?: unknown
  readonly error?: string
}

export interface ChildSummary {
  readonly childId: string
  readonly agent: string
  readonly status: ChildStatus
}

