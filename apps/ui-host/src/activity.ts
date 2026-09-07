export interface AgentActivity {
  readonly id: string
  readonly agent: string
  readonly status: string
  readonly at: number
}

export interface ActivityStore {
  setStatus(agent: string, status: string): AgentActivity
  list(): ReadonlyArray<AgentActivity>
  statuses(): Readonly<Record<string, string>>
}

export const makeActivityStore = (file = process.env.UI_DATABASE ?? ".effect-agent/ui.sqlite"): ActivityStore => {
  if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true })
  const database = new Database(file, { create: true })
  database.run("CREATE TABLE IF NOT EXISTS ui_activity (id TEXT PRIMARY KEY, agent TEXT, status TEXT, at INTEGER)")
  const all = () => database.query("SELECT id, agent, status, at FROM ui_activity ORDER BY at DESC LIMIT 100").all() as AgentActivity[]
  return {
    setStatus: (agent, status) => {
      const event = { id: crypto.randomUUID(), agent, status, at: Date.now() }
      database.run("INSERT INTO ui_activity VALUES (?, ?, ?, ?)", [event.id, event.agent, event.status, event.at])
      return event
    },
    list: () => all().map((event) => ({ ...event })),
    statuses: () => {
      const statuses = new Map<string, string>()
      for (const event of [...all()].reverse()) if (event.status === "") statuses.delete(event.agent); else statuses.set(event.agent, event.status)
      return Object.fromEntries(statuses)
    }
  }
}
import { Database } from "bun:sqlite"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
