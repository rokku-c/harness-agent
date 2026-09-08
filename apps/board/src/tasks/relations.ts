import { BoardError, type Task } from "./schema.ts"

/** Hierarchy and dependency edges are data constraints, not a scheduler. */
export const validateRelations = (tasks: readonly Task[], candidate: Task): void => {
  const map = new Map(tasks.map((t) => [t.id, t])); map.set(candidate.id, candidate)
  const references = [...candidate.dependsOn, ...(candidate.parentId ? [candidate.parentId] : [])]
  if (references.some((id) => !map.has(id))) throw new BoardError(400, "Referenced task does not exist")
  if (new Set(candidate.dependsOn).size !== candidate.dependsOn.length) throw new BoardError(400, "Duplicate dependency")
  const walk = (id: string, seen: Set<string>, kind: "parent" | "dependency"): void => {
    if (seen.has(id)) throw new BoardError(409, `${kind} cycle is not allowed`)
    const task = map.get(id)
    if (!task) return
    const next = new Set(seen); next.add(id)
    for (const ref of kind === "parent" ? (task.parentId ? [task.parentId] : []) : task.dependsOn) walk(ref, next, kind)
  }
  walk(candidate.id, new Set(), "parent")
  walk(candidate.id, new Set(), "dependency")
}
export const assertDeletable = (tasks: readonly Task[], id: string): void => {
  if (tasks.some((task) => task.parentId === id || task.dependsOn.includes(id))) {
    throw new BoardError(409, "Remove child/dependency references before deleting this task")
  }
}
export type TaskTree = Task & { children: TaskTree[] }
export const taskTree = (tasks: readonly Task[]): TaskTree[] => {
  const branch = (parentId?: string): TaskTree[] => tasks.filter((task) => task.parentId === parentId)
    .map((task) => ({ ...task, children: branch(task.id) }))
  return branch()
}
