/**
 * Task writes, plus the one policy board enforces on the tree: a node with
 * children has no state of its own, so only cancellation may be set on it
 * directly. Cancelling cancels everything below it, so no leaf is left running.
 */
import type { TaskStore } from "../storage/store.ts"
import { assertDeletable, descendantIds, validateRelations, validateSchedule } from "./relations.ts"
import { BoardError, createTaskSchema, updateTaskSchema, parse, type Task, type TaskInput, type TaskPatch } from "./schema.ts"

export const makeTaskMutations = (store: TaskStore) => {
  const get = (id: string): Task => {
    const task = store.list().find((task) => task.id === id)
    if (task === undefined) throw new BoardError(404, "Task not found")
    return task
  }
  const assertStateWritable = (task: Task, state: unknown): void => {
    if (state === undefined || state === "cancelled") return
    if (!store.list().some((candidate) => candidate.parentId === task.id)) return
    throw new BoardError(409, `Node ${task.id} has children and derives its state from them; only cancelled may be set directly`)
  }
  const cascadeCancel = (task: Task, at: number): void => {
    for (const id of descendantIds(store.list(), task.id)) {
      const child = get(id)
      store.put({ ...child, state: "cancelled", updatedAt: Math.max(at, child.updatedAt + 1) })
    }
  }
  return {
    get,
    create: (input: TaskInput): Task => store.transaction(() => {
      const value = parse(createTaskSchema, input), now = Date.now()
      const task: Task = { ...value, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      validateSchedule(task); validateRelations(store.list(), task)
      store.put(task); store.event("task.created", task.id, task)
      return task
    }),
    update: (id: string, input: TaskPatch): Task => store.transaction(() => {
      const { parentId, startAt, dueAt, ...fields } = parse(updateTaskSchema, input), previous = get(id)
      assertStateWritable(previous, fields.state)
      const now = Math.max(Date.now(), previous.updatedAt + 1)
      const task: Task = { ...previous, ...fields, updatedAt: now }
      // an explicit null clears the field; an omitted field keeps its value
      const parent = parentId === null ? undefined : parentId ?? previous.parentId
      const start = startAt === null ? undefined : startAt ?? previous.startAt
      const due = dueAt === null ? undefined : dueAt ?? previous.dueAt
      if (parent === undefined) delete task.parentId; else task.parentId = parent
      if (start === undefined) delete task.startAt; else task.startAt = start
      if (due === undefined) delete task.dueAt; else task.dueAt = due
      validateSchedule(task); validateRelations(store.list(), task)
      if (fields.state === "cancelled") cascadeCancel(task, now)
      store.put(task); store.event("task.updated", task.id, task)
      return task
    }),
    delete: (id: string) => store.transaction(() => {
      const task = get(id)
      assertDeletable(store.list(), id)
      store.delete(id); store.event("task.deleted", id, task)
      return { ok: true }
    }),
  }
}
export type TaskMutations = ReturnType<typeof makeTaskMutations>
