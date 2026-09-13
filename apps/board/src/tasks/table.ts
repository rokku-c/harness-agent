/**
 * A task table: the same tasks, laid out as rows instead of a tree.
 *
 * A table is a *projection*, not a second place tasks live — nothing here is
 * stored, and every cell is either a field the task already has or a value the
 * tree view derives from the same records. The one column that earns the table
 * its place is `agent`: which agent instance is handling a node, which is
 * awkward to see in a tree of cards and obvious in a row.
 *
 * That column reports the run *holding* the node right now and nothing else. A
 * node has at most one running run, so the answer is unambiguous, and an ended
 * run is history for `board_runs` rather than an assignment the table would
 * show as if it were current.
 */
import type { Run } from "../runs/schema.ts"
import { rollupTree, type DerivedState } from "./rollup.ts"
import type { Task } from "./schema.ts"
import { signalsOf } from "./signals.ts"
import { treeOrder } from "./tree-order.ts"

/** Every column a row carries. `columns` selects what to show, not what is read. */
export const tableColumns = [
  "id", "title", "body", "state", "rollup", "depth", "parentId", "parentTitle", "dependsOn", "waits",
  "failure", "startAt", "dueAt", "agent", "kind", "channel", "sessionRef", "heldSince",
] as const
export type TableColumn = (typeof tableColumns)[number]

export interface TaskTableRow {
  readonly id: string
  readonly title: string
  /** The task's own text, so a row can be read without a second call. */
  readonly body: string
  /** What an operator set on the task itself. */
  readonly state: Task["state"]
  /** What its children make it, absent for a task with none. */
  readonly rollup: DerivedState | undefined
  /** How deep the task sits: 0 for a root, 1 for its child. */
  readonly depth: number
  readonly parentId: string | undefined
  /** The parent's title; the readable half of `parentId`. */
  readonly parentTitle: string | undefined
  readonly dependsOn: readonly string[]
  /** The unfinished dependencies, by title — what this row is waiting for. */
  readonly waits: string | undefined
  /** Why the last run on this node stopped, when the node is blocked. */
  readonly failure: string | undefined
  readonly startAt: number | undefined
  readonly dueAt: number | undefined
  /** The agent instance holding the node now; absent when nobody holds it. */
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
