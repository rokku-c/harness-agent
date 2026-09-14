import type { Run } from "../runs/schema.ts"
import type { DerivedState } from "./rollup.ts"
import type { Task } from "./schema.ts"

export interface Signals {
  readonly holder: Run | undefined
  readonly parentTitle: string | undefined
  readonly waits: string | undefined
  readonly failure: string | undefined
}

const holderPerNode = (runs: readonly Run[]): Map<string, Run> => {
  const out = new Map<string, Run>()
  for (const run of runs) if (run.status === "running") out.set(run.nodeId, run)
  return out
}

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
    failure: task.state === "blocked" ? ended.get(task.id)?.summary ?? undefined : undefined,
  }]))
}
