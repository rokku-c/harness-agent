import type { WorkItem, WorkItemState } from "./work.ts"
import { descendants, isLeaf } from "./task-tree.ts"

export interface Rollup { readonly state: WorkItemState | "open"; readonly leaves: number; readonly doneLeaves: number; readonly progress: number }

export const rollup = (items: ReadonlyMap<string, WorkItem>, rootId: string): Rollup => {
  const all = [items.get(rootId), ...descendants(items, rootId)].filter((x): x is WorkItem => Boolean(x))
  const leaves = all.filter(isLeaf)
  const doneLeaves = leaves.filter((x) => x.state === "done").length
  const state: Rollup["state"] = leaves.length === 0 ? "open"
    : leaves.some((x) => x.state === "blocked") ? "blocked"
    : leaves.some((x) => x.state === "doing") ? "doing"
    : doneLeaves === leaves.length ? "done" : "open"
  return { state, leaves: leaves.length, doneLeaves, progress: leaves.length ? doneLeaves / leaves.length : 0 }
}
