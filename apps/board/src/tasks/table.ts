import type { Run } from "../runs/schema.ts"
import { rollupTree, type DerivedState } from "./rollup.ts"
import type { Task } from "./schema.ts"
import { signalsOf } from "./signals.ts"
import { treeOrder } from "./tree-order.ts"

export const tableColumns = [
  "id", "title", "body", "state", "rollup", "depth", "parentId", "parentTitle", "dependsOn", "waits",
  "failure", "startAt", "dueAt", "agent", "kind", "channel", "sessionRef", "heldSince",
] as const
export type TableColumn = (typeof tableColumns)[number]

export interface TaskTableRow {
  readonly id: string
  readonly title: string
  readonly body: string
  readonly state: Task["state"]
  readonly rollup: DerivedState | undefined
  readonly depth: number
  readonly parentId: string | undefined
  readonly parentTitle: string | undefined
  readonly dependsOn: readonly string[]
  readonly waits: string | undefined
  readonly failure: string | undefined
  readonly startAt: number | undefined
  readonly dueAt: number | undefined
  readonly agent: string | undefined
  readonly kind: string | undefined
  readonly channel: Run["channel"] | undefined
  readonly sessionRef: string | undefined
  readonly heldSince: number | undefined
}

export interface TaskTable {
  readonly columns: readonly TableColumn[]
  readonly rows: readonly TaskTableRow[]
}

export const parseColumns = (requested: readonly string[] | undefined): readonly TableColumn[] => {
  if (requested === undefined || requested.length === 0) return tableColumns
  const unknown = requested.filter((name) => !(tableColumns as readonly string[]).includes(name))
  if (unknown.length > 0) {
    throw new Error(`Unknown table column(s) ${unknown.join(", ")}; columns are ${tableColumns.join(", ")}`)
  }
  return requested as readonly TableColumn[]
}

export const taskTable = (tasks: readonly Task[], runs: readonly Run[], columns?: readonly string[]): TaskTable => {
  const shown = parseColumns(columns), derived = rollupTree(tasks, runs), signals = signalsOf(tasks, derived, runs)
  return {
    columns: shown,
    rows: treeOrder(tasks).map(({ task, depth }) => {
      const signal = signals.get(task.id), run = signal?.holder
      return {
        id: task.id,
        title: task.title,
        body: task.body,
        state: task.state,
        rollup: derived.get(task.id)?.state,
        depth,
        parentId: task.parentId,
        parentTitle: signal?.parentTitle,
        dependsOn: task.dependsOn,
        waits: signal?.waits,
        failure: signal?.failure,
        startAt: task.startAt,
        dueAt: task.dueAt,
        agent: run?.agentId,
        kind: run?.kind,
        channel: run?.channel,
        sessionRef: run?.sessionRef,
        heldSince: run?.startedAt,
      }
    }),
  }
}
