import type { Database } from "bun:sqlite"
import { parse, taskSchema, type Task } from "../tasks/schema.ts"

export interface TaskEvent { seq: number; at: number; kind: string; taskId: string; data: unknown }
export const makeTaskStore = (db: Database) => {
  let closed = false
  const check = () => { if (closed) throw new Error("Board store is closed") }
  return {
    list: (): Task[] => {
      check()
      return db.query<{ data: string }, []>("SELECT data FROM tasks ORDER BY rowid").all().map((row) => parse(taskSchema, JSON.parse(row.data)))
    },
    put: (task: Task) => { check(); db.run("INSERT INTO tasks(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data", [task.id, JSON.stringify(task)]) },
    delete: (id: string) => { check(); db.run("DELETE FROM tasks WHERE id=?", [id]) },
    /** `kind` names what happened, `subjectId` what it happened to (a task or an agent). */
    event: (kind: string, subjectId: string, data: unknown) => {
      check(); db.run("INSERT INTO task_events(at,kind,taskId,data) VALUES(?,?,?,?)", [Date.now(), kind, subjectId, JSON.stringify(data)])
    },
    events: (after = 0): TaskEvent[] => {
      check()
      return db.query<Omit<TaskEvent, "data"> & { data: string }, [number]>("SELECT * FROM task_events WHERE seq > ? ORDER BY seq LIMIT 200").all(after)
        .map((row) => ({ ...row, data: JSON.parse(row.data) }))
    },
    /**
     * The most recent events, oldest first. A reader that wants "what is
     * happening now" cannot ask `events(0)`: that reads forward from the
     * beginning and stops at the page limit, so a board with more history than
     * one page shows only its oldest events and never the new ones.
     */
    recentEvents: (limit: number): TaskEvent[] => {
      check()
      return db.query<Omit<TaskEvent, "data"> & { data: string }, [number]>(
        "SELECT * FROM (SELECT * FROM task_events ORDER BY seq DESC LIMIT ?) ORDER BY seq ASC").all(limit)
        .map((row) => ({ ...row, data: JSON.parse(row.data) }))
    },
    transaction: <T>(run: () => T): T => { check(); return db.transaction(run).immediate() },
    close: () => { if (!closed) { closed = true; db.close() } },
  }
}
export type TaskStore = ReturnType<typeof makeTaskStore>
