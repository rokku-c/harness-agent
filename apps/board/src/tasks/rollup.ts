import { taskTree, type TaskTree } from "./relations.ts"
import { BoardError, type Task } from "./schema.ts"
import type { Run } from "../runs/schema.ts"

export type DerivedState = Task["state"]
export type NodeKind = "goal" | "group" | "leaf"
export interface Rollup {
  readonly kind: NodeKind
  readonly state: DerivedState
  readonly progress: number
  readonly leaves: number
  readonly doneLeaves: number
  readonly running: boolean
  readonly interrupted: boolean
}
const terminal = (task: Task): boolean => task.state === "done" || task.state === "cancelled"

const derive = (leaves: readonly Task[], running: boolean): DerivedState => {
  if (leaves.every((leaf) => leaf.state === "done")) return "done"
  if (leaves.every((leaf) => leaf.state === "cancelled")) return "cancelled"
  if (leaves.every(terminal)) return "done"
  if (leaves.some((leaf) => leaf.state === "blocked")) return "blocked"
  if (running || leaves.some((leaf) => leaf.state === "doing")) return "doing"
  return "todo"
}

const latestRunByNode = (runs: readonly Run[]): Map<string, Run> => {
  const out = new Map<string, Run>()
  for (const run of runs) {
    const current = out.get(run.nodeId)
    if (current === undefined || run.startedAt >= current.startedAt) out.set(run.nodeId, run)
  }
  return out
}

export const rollupTree = (tasks: readonly Task[], runs: readonly Run[]): Map<string, Rollup> => {
  const latest = latestRunByNode(runs)
  const children = new Map<string, Task[]>()
  for (const task of tasks) {
    const parent = task.parentId
    if (parent === undefined) continue
    const siblings = children.get(parent)
    if (siblings === undefined) children.set(parent, [task])
    else siblings.push(task)
  }
  const out = new Map<string, Rollup>()
  const visit = (task: Task): Task[] => {
    const below = children.get(task.id) ?? []
    const leaves = below.length ? below.flatMap(visit) : [task]
    const doneLeaves = leaves.filter((leaf) => leaf.state === "done").length
    const last = latest.get(task.id)
    const isRunning = last?.status === "running" || below.some((child) => out.get(child.id)?.running === true)
    const isInterrupted = last?.status === "orphan" || below.some((child) => out.get(child.id)?.interrupted === true)
    out.set(task.id, {
      kind: below.length === 0 ? "leaf" : task.parentId === undefined ? "goal" : "group",
      state: below.length === 0 ? task.state : derive(leaves, isRunning),
      progress: leaves.length === 0 ? 0 : doneLeaves / leaves.length,
      leaves: leaves.length, doneLeaves, running: isRunning, interrupted: isInterrupted,
    })
    return leaves
  }
  for (const task of tasks) if (!task.parentId) visit(task)
  for (const task of tasks) if (!out.has(task.id)) visit(task)
  return out
}

export type RolledNode = TaskTree & Rollup
export const rollupForest = (tasks: readonly Task[], runs: readonly Run[]): RolledNode[] => {
  const derived = rollupTree(tasks, runs)
  const annotate = (node: TaskTree): RolledNode => {
    const rollup = derived.get(node.id)
    if (rollup === undefined) throw new BoardError(500, `No rollup for node ${node.id}`)
    return { ...node, ...rollup, children: node.children.map(annotate) }
  }
  return taskTree(tasks).map(annotate)
}
