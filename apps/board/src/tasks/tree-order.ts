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
