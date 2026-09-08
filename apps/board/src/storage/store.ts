import { openBoardDatabase } from "./database.ts"
import { parse, taskSchema, type Task } from "../tasks/schema.ts"

export interface TaskEvent { seq: number; at: number; kind: string; taskId: string; data: unknown }
export const makeTaskStore = (file: string) => {
  const db = openBoardDatabase(file)
  let closed = false
  const check = () => { if (closed) throw new Error("Board store is closed") }
  return {
    list: (): Task[] => {
      check()
      return db.query<{ data: string }, []>("SELECT data FROM tasks ORDER BY rowid").all().map((row) => parse(taskSchema, JSON.parse(row.data)))
    },
    put: (task: Task) => { check(); db.run("INSERT INTO tasks(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", [task.id, JSON.stringify(task)]) },
    delete: (id: string) => { check(); db.run("DELETE FROM tasks WHERE id=?", [id]) },
    event: (kind: string, task: Task) => {
      check(); db.run("INSERT INTO task_events(at,kind,taskId,data) VALUES(?,?,?,?)", [Date.now(), kind, task.id, JSON.stringify(task)])
    },
    events: (after = 0): TaskEvent[] => {
      check()
      return db.query<Omit<TaskEvent, "data"> & { data: string }, [number]>("SELECT * FROM task_events WHERE seq > ? ORDER BY seq LIMIT 200").all(after)
        .map((row) => ({ ...row, data: JSON.parse(row.data) }))
    },
    transaction: <T>(run: () => T): T => { check(); return db.transaction(run).immediate() },
    close: () => { if (!closed) { closed = true; db.close() } },
  }
}
export type TaskStore = ReturnType<typeof makeTaskStore>
