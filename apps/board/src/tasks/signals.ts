/**
 * What a worktable row says about a task beyond the task's own fields.
 *
 * A table is read down a column, so a cell has to be legible on its own — and a
 * task's relations are stored as *references*. `parentId` and `dependsOn` are
 * ids, so a table that shows them raw shows UUIDs where the operator is asking
 * one of three questions: what is this under, what is it waiting for, and why
 * did it stop. Those three answers are resolved here, where the whole forest is
 * in hand, instead of being left to a client that sees one row at a time.
 */
import type { Run } from "../runs/schema.ts"
import type { DerivedState } from "./rollup.ts"
import type { Task } from "./schema.ts"

export interface Signals {
  /** Who holds the node right now; absent when nobody does. */
  readonly holder: Run | undefined
  /** The parent's title, so a hierarchy reads without an id. */
  readonly parentTitle: string | undefined
  /** The things it depends on that are not finished, by title; absent when nothing blocks it. */
  readonly waits: string | undefined
  /** Why the last run on this node stopped, for a blocked node; absent otherwise. */
  readonly failure: string | undefined
}

/** The one run holding each node: a node has at most one, so the answer is unambiguous. */
const holderPerNode = (runs: readonly Run[]): Map<string, Run> => {
  const out = new Map<string, Run>()
  for (const run of runs) if (run.status === "running") out.set(run.nodeId, run)
  return out
}

/** The run that ended most recently on each node — the one whose summary explains it. */
const endedByNode = (runs: readonly Run[]): Map<string, Run> => {
  const out = new Map<string, Run>()
  for (const run of runs) {
    if (run.status === "running") continue
    const current = out.get(run.nodeId)
    const at = run.endedAt ?? run.startedAt, seen = current === undefined ? -1 : current.endedAt ?? current.startedAt
    if (at >= seen) out.set(run.nodeId, run)
  }
  return out
}

const waitingOn = (task: Task, titles: ReadonlyMap<string, string>, state: (id: string) => DerivedState | undefined): string | undefined => {
  // a dependency blocks until it is finished, and "finished" is what the tree
  // derives — a parent whose own state still reads `doing` is done when its
  // leaves are, and a row that called that "waiting" would be wrong
  const blocking = task.dependsOn.filter((id) => state(id) !== "done").map((id) => titles.get(id) ?? id)
  return blocking.length === 0 ? undefined : blocking.join(", ")
}

export const signalsOf = (
  tasks: readonly Task[],
  derived: ReadonlyMap<string, { readonly state: DerivedState }>,
  runs: readonly Run[],
): Map<string, Signals> => {
  const titles = new Map(tasks.map((task) => [task.id, task.title])), ended = endedByNode(runs), holders = holderPerNode(runs)
  const state = (id: string): DerivedState | undefined => derived.get(id)?.state
  return new Map(tasks.map((task) => [task.id, {
    holder: holders.get(task.id),
    parentTitle: task.parentId === undefined ? undefined : titles.get(task.parentId),
    waits: waitingOn(task, titles, state),
    // only a stopped node needs the reason; a summary on a running or done one
    // is history the runs surface owns
    failure: task.state === "blocked" ? ended.get(task.id)?.summary ?? undefined : undefined,
  }]))
}
