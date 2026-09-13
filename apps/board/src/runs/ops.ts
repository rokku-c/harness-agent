/**
 * The run surface: an agent instance holding a task node, declared once.
 *
 * `sync` is the hello an agent makes on arrival; the rest is the run lifecycle.
 * Board records what an agent declares and never schedules anything itself.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { BoardApi } from "../board.ts"
import { announceSchema, finishSchema, progressSchema, startRunSchema } from "./schema.ts"

const byNode = z.object({ nodeId: z.string().min(1).optional() }).strict()

export const runOperations = (board: BoardApi): readonly Operation[] => [
  operation({ name: "board_sync", description: "Announce this agent instance to the board and receive it in one round trip",
    input: announceSchema, http: { method: "POST", path: "/api/sync" }, handler: (input) => board.sync(input) }),
  operation({ name: "board_agents", description: "List announced agent instances with derived presence", access: "read",
    input: noInput, http: { method: "GET", path: "/api/agents" }, handler: () => ({ agents: board.agents() }) }),
  operation({ name: "board_runs", description: "List execution records, optionally for one node", access: "read",
    input: byNode, http: { method: "GET", path: "/api/runs" }, handler: (input) => ({ runs: board.runs(input.nodeId) }) }),
  operation({ name: "board_run_start", description: "Take a task node and hold it while working; refuses if another run holds it",
    input: startRunSchema, http: { method: "POST", path: "/api/runs", status: 201 }, handler: (input) => board.start(input) }),
  // the runId is in the path, so a caller reporting progress cannot report it
  // against a run other than the one it named; the schema already requires it
  operation({ name: "board_run_progress", description: "Report progress on a run you hold", input: progressSchema,
    http: { method: "POST", path: "/api/runs/:runId/progress" }, handler: (input) => board.progress(input) }),
  operation({ name: "board_run_finish", description: "Report the outcome of a run you hold (done | failed)", input: finishSchema,
    http: { method: "POST", path: "/api/runs/:runId/finish" }, handler: (input) => board.finish(input) }),
]
