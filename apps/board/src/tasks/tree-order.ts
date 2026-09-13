/**
 * The tasks in tree order, each with how deep it sits.
 *
 * Every parent comes before its children, so a flat list of rows reads as the
 * tree it is, and `depth` is the indent a reader needs without a second walk.
 *
 * Two tasks may point at each other (nothing in the schema forbids it) and a
 * task may name a parent that no longer exists. Neither may hide a row: a task
 * whose parent is unknown is treated as a root, and anything the walk down from
 * the roots does not reach — the members of a parent cycle — is walked again as
 * a root of its own, so every task appears exactly once.
 */
import type { Task } from "./schema.ts"

export interface OrderedTask {
  readonly task: Task
  readonly depth: number
}

export const treeOrder = (tasks: readonly Task[]): readonly OrderedTask[] => {
  const known = new Set(tasks.map((task) => task.id))
  const children = new Map<string | undefined, Task[]>()
  for (const task of tasks) {
    const parent = task.parentId !== undefined && known.has(task.parentId) ? task.parentId : undefined
    children.set(parent, [...(children.get(parent) ?? []), task])
  }
  const out: OrderedTask[] = [], seen = new Set<string>()
  const walk = (task: Task, depth: number): void => {
    if (seen.has(task.id)) return
    seen.add(task.id); out.push({ task, depth })
    for (const child of children.get(task.id) ?? []) walk(child, depth + 1)
  }
  for (const root of children.get(undefined) ?? []) walk(root, 0)
  for (const task of tasks) walk(task, 0)
  return out
}
