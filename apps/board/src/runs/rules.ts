/**
 * The rules around a run. Two of them do the real work:
 * - a node has at most one running run, so two agents can never both believe
 *   they own it - the second start is refused and told who holds it;
 * - only the agent that holds a run may report on it.
 */
import { BoardError, type Task } from "../tasks/schema.ts"
import type { ReportedState, Run } from "./schema.ts"

export const assertNodeExists = (task: Task | undefined, nodeId: string): Task => {
  if (task === undefined) throw new BoardError(404, `Task not found: ${nodeId}`)
  return task
}
export const assertStartable = (running: Run | undefined): void => {
  if (running !== undefined) {
    throw new BoardError(409, `Node ${running.nodeId} is already running: run ${running.runId} held by ${running.agentId}`)
  }
}
export const assertHolds = (run: Run | undefined, agentId: string, runId: string): Run => {
  if (run === undefined) throw new BoardError(404, `Run not found: ${runId}`)
  if (run.agentId !== agentId) throw new BoardError(409, `Run ${runId} is held by ${run.agentId}, not ${agentId}`)
  if (run.status !== "running") throw new BoardError(409, `Run ${runId} already ended as ${run.status}`)
  return run
}
/**
 * A run reports done or failed; the node takes the closest state board has. A
 * failure becomes blocked (it needs attention) and the run keeps the truth on
 * its own record - board does not invent a state its task machine lacks.
 */
export const nodeStateFor = (status: ReportedState): "done" | "blocked" =>
  status === "done" ? "done" : "blocked"
