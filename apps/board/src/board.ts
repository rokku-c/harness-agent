import { makeTaskStore } from "./storage/store.ts"
import { BoardError, createTaskSchema, updateTaskSchema, parse, states, type Task, type TaskInput, type TaskPatch } from "./tasks/schema.ts"
import { assertDeletable, taskTree, validateRelations } from "./tasks/relations.ts"

/** SQLite mutations and events commit together; no cached snapshot or resource scheduler. */
export const makeBoard = ({ dataFile = ":memory:" }: { dataFile?: string } = {}) => {
  const store = makeTaskStore(dataFile)
  const get = (id: string): Task => {
    const task = store.list().find((task) => task.id === id)
    if (!task) throw new BoardError(404, "Task not found")
    return task
  }
  return {
    list: store.list, get, events: store.events, close: store.close,
    state: () => {
      const tasks = store.list()
      return { tasks, counts: Object.fromEntries(states.map((state) => [state, tasks.filter((task) => task.state === state).length])) }
    },
    tree: () => ({ roots: taskTree(store.list()) }),
    create: (input: TaskInput): Task => store.transaction(() => {
      const value = parse(createTaskSchema, input), now = Date.now()
      const task: Task = { ...value, id: crypto.randomUUID(), createdAt: now, updatedAt: now }
      validateRelations(store.list(), task)
      store.put(task); store.event("task.created", task)
      return task
    }),
    update: (id: string, input: TaskPatch): Task => store.transaction(() => {
      const patch = parse(updateTaskSchema, input), previous = get(id)
      const task: Task = { ...previous, ...patch, parentId: patch.parentId === null ? undefined : patch.parentId ?? previous.parentId,
        updatedAt: Math.max(Date.now(), previous.updatedAt + 1) }
      validateRelations(store.list(), task)
      store.put(task); store.event("task.updated", task)
      return task
    }),
    delete: (id: string) => store.transaction(() => {
      const task = get(id)
      assertDeletable(store.list(), id)
      store.delete(id); store.event("task.deleted", task)
      return { ok: true }
    }),
  }
}
export type BoardApi = ReturnType<typeof makeBoard>
