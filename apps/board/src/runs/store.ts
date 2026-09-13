import type { Database } from "bun:sqlite"
import type { z } from "@effect-agent/effect-config"
import { parse } from "../tasks/schema.ts"
import { agentSchema, runSchema, type Agent, type Run } from "./schema.ts"

export const makeRunStore = (db: Database) => {
  const one = <T>(sql: string, key: string, schema: z.ZodType<T>): T | undefined => {
    const row = db.query<{ data: string }, [string]>(sql).get(key)
    return row === undefined || row === null ? undefined : parse(schema, JSON.parse(row.data))
  }
  /**
   * The ONE writer of a run. `status` and `nodeId` are denormalised columns that
   * make the running-run lookup a plain index hit; writing them anywhere but
   * here is how the column and the record drift apart.
   */
  const putRun = (run: Run) => db.run("INSERT INTO runs(id,nodeId,status,data) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET nodeId=excluded.nodeId, status=excluded.status, data=excluded.data",
    [run.runId, run.nodeId, run.status, JSON.stringify(run)])
  return {
    agents: (): Agent[] => db.query<{ data: string }, []>("SELECT data FROM agents ORDER BY id").all()
      .map((row) => parse(agentSchema, JSON.parse(row.data))),
    getAgent: (agentId: string): Agent | undefined =>
      one("SELECT data FROM agents WHERE id=?", agentId, agentSchema),
    putAgent: (agent: Agent) => db.run("INSERT INTO agents(id,data) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
      [agent.agentId, JSON.stringify(agent)]),
    runs: (nodeId?: string): Run[] => (nodeId === undefined
      ? db.query<{ data: string }, []>("SELECT data FROM runs ORDER BY rowid").all()
      : db.query<{ data: string }, [string]>("SELECT data FROM runs WHERE nodeId=? ORDER BY rowid").all(nodeId))
      .map((row) => parse(runSchema, JSON.parse(row.data))),
    getRun: (runId: string): Run | undefined =>
      one("SELECT data FROM runs WHERE id=?", runId, runSchema),
    runningOn: (nodeId: string): Run | undefined =>
      one("SELECT data FROM runs WHERE nodeId=? AND status='running'", nodeId, runSchema),
    putRun,
    /**
     * A run still marked running after a restart has no live agent behind it.
     * No `endedAt` is invented: board knows the run stopped being held, not when.
     */
    orphanRunning: (): Run[] => {
      const stale = db.query<{ data: string }, []>("SELECT data FROM runs WHERE status='running'").all()
        .map((row) => parse(runSchema, JSON.parse(row.data)))
      for (const run of stale) putRun({ ...run, status: "orphan" })
      return stale
    },
  }
}
export type RunStore = ReturnType<typeof makeRunStore>
