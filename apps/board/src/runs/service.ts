/**
 * The run-facing surface: agents announce themselves, hold a node while they
 * work, and report the outcome. Every mutation runs in the same transaction the
 * rest of board uses, so a run and the node state it changes commit together.
 */
import type { TaskStore } from "../storage/store.ts"
import { parse, type Task } from "../tasks/schema.ts"
import { announced, withPresence } from "./presence.ts"
import { assertHolds, assertNodeExists, assertStartable, nodeStateFor } from "./rules.ts"
import { announceSchema, finishSchema, progressSchema, startRunSchema, type Agent, type Run } from "./schema.ts"
import type { RunStore } from "./store.ts"

/** progress can be chatty; at most one progress event per run per window */
export const PROGRESS_WINDOW_MS = 1_000

export const makeRuns = (store: TaskStore, runs: RunStore, now: () => number = Date.now) => {
  const task = (id: string): Task | undefined => store.list().find((candidate) => candidate.id === id)
  const isLeaf = (id: string): boolean => !store.list().some((candidate) => candidate.parentId === id)
  const revised = (node: Task, state: Task["state"], at: number): void => {
    store.put({ ...node, state, updatedAt: Math.max(at, node.updatedAt + 1) })
  }
  const emittedAt = new Map<string, number>()
  return {
    /**
     * A heartbeat is not an event: agents announce on a timer, and recording each
     * one would turn the event ring into a presence log nobody reads.
     */
    announce: (input: unknown): Agent => store.transaction(() => {
      const value = parse(announceSchema, input)
      const agent = announced(runs.getAgent(value.agentId), value, now())
      runs.putAgent(agent)
      return agent
    }),
    start: (input: unknown): Run => store.transaction(() => {
      const value = parse(startRunSchema, input)
      const node = assertNodeExists(task(value.nodeId), value.nodeId)
      assertStartable(runs.runningOn(value.nodeId))
      const agent = announced(runs.getAgent(value.agentId), value, now())
      runs.putAgent(agent)
      const startedAt = now()
      const run: Run = {
        runId: crypto.randomUUID(), nodeId: node.id, agentId: agent.agentId, kind: agent.kind,
        channel: agent.channel, status: "running", startedAt,
        ...(value.sessionRef !== undefined ? { sessionRef: value.sessionRef } : {}),
      }
      runs.putRun(run)
      // a leaf reflects the run it is hosting; a parent's state stays derived
      if (isLeaf(node.id)) revised(node, "doing", startedAt)
      store.event("run.started", node.id, run)
      return run
    }),
    progress: (input: unknown): Run => store.transaction(() => {
      const value = parse(progressSchema, input)
      const run = assertHolds(runs.getRun(value.runId), value.agentId, value.runId)
      const at = now(), updated: Run = { ...run, note: value.note }
      runs.putRun(updated)
      if (at - (emittedAt.get(run.runId) ?? 0) >= PROGRESS_WINDOW_MS) {
        store.event("run.progress", run.nodeId, { runId: run.runId, note: value.note })
        emittedAt.set(run.runId, at)
      }
      return updated
    }),
    finish: (input: unknown): Run => store.transaction(() => {
      const value = parse(finishSchema, input)
      const run = assertHolds(runs.getRun(value.runId), value.agentId, value.runId)
      const endedAt = now(), ended: Run = { ...run, status: value.status, endedAt, summary: value.summary }
      runs.putRun(ended)
      emittedAt.delete(run.runId)
      const node = task(run.nodeId)
      if (node !== undefined && isLeaf(node.id)) revised(node, nodeStateFor(value.status), endedAt)
      store.event(value.status === "done" ? "run.finished" : "run.failed", run.nodeId, ended)
      return ended
    }),
    agents: (): (Agent & { presence: "online" | "offline" })[] => withPresence(runs.agents(), now()),
    runs: runs.runs,
  }
}
export type RunsApi = ReturnType<typeof makeRuns>
