import type { Tier } from "./supply.ts"

export type WorkKind = "note" | "reminder" | "task"

export interface ResourceWriteCap {
  readonly name: string
  readonly tier: Tier
  readonly description: string
}

export interface ResourceDecl {
  readonly kind: WorkKind
  readonly label: string
  readonly write: ResourceWriteCap
}

export const WORKSPACE_RESOURCES: readonly ResourceDecl[] = [
  {
    kind: "note",
    label: "note",
    write: {
      name: "note_write",
      tier: "extended",
      description: "Append a note to the workspace."
    }
  },
  {
    kind: "reminder",
    label: "reminder",
    write: {
      name: "set_reminder",
      tier: "extended",
      description: "Record a reminder."
    }
  },
  {
    kind: "task",
    label: "task",
    write: {
      name: "task_write",
      tier: "extended",
      description: "Record a task in the workspace."
    }
  }
]
