/**
 * workspace resource declarations - the resource layer of clew.
 *
 * A resource is one declarative entry: a kind (record tag in the workspace
 * log) plus the write-capability it exposes. The session agent GENERATES the
 * append ops, the recall filter union, and (later) UI forms from these
 * declarations - adding a resource (e.g. "task") means adding one entry here;
 * nothing else needs hand-written code (see the fake-resource test).
 */
import type { Tier } from "./supply.ts"

export type WorkKind = "note" | "reminder" | "task"

export interface ResourceWriteCap {
  /** append-op name, e.g. note_write */
  readonly name: string
  readonly tier: Tier
  /** model-facing description (single source) */
  readonly description: string
}

export interface ResourceDecl {
  readonly kind: WorkKind
  /** human/model-facing singular label */
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
