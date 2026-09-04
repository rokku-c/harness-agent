/**
 * The builtin coordinator agent (layer ③ of the board design).
 *
 * It is an ordinary effect-agent session whose ops ARE the board (see
 * ops.ts): it reads the current columns, reads the parent goal, and breaks
 * it down into concrete subtasks it creates under parentId. Nothing about
 * coordination is magic - an external agent could do the same through the
 * MCP surface; this agent is just the one the board ships with, so a
 * bare install already knows how to plan a goal.
 *
 * The agent REPLIES (Until.schema) with { summary, done, created } and never
 * touches the governor: starting/reporting subtasks stays with executors.
 */
import { Effect, Schema } from "effect"
import {
  Agent, AgentContext, Until,
  type AgentError, type AgentProgram
} from "@effect-agent/core"
import { EffectAgent, type Model } from "@effect-agent/builtin"
import type { BoardApi } from "./board.ts"
import type { WorkItem } from "./domain.ts"
import { boardCoordinatorBinding } from "./ops.ts"

export const CoordinatorReply = Schema.Struct({
  summary: Schema.String,
  done: Schema.Boolean,
  /** item ids of the subtasks this run created */
  created: Schema.Array(Schema.String)
})
export type CoordinatorReplyType = { summary: string; done: boolean; created: ReadonlyArray<string> }

const COORDINATOR_INSTRUCTIONS =
  "You are the builtin board coordinator. Your job: turn a goal into a " +
  "concrete breakdown of board work items. First read the board (board_view) " +
  "and the goal item itself (board_item) when the goal mentions an itemId. " +
  "Then create focused subtasks with board_create_item, always passing " +
  "parentId = the goal item id when one is given; add dependencies between " +
  "subtasks where order matters, and use requires only when a subtask needs a " +
  "board resource (check board_view/board_item for resource availability - do " +
  "not guess ids). Prefer few, actionable items over many vague ones. " +
  "Finish by replying with ONE JSON object matching the contract: " +
  "{\"summary\": \"what was planned\", \"done\": true, \"created\": [\"item id(s)\"]}. " +
  "Output ONLY that JSON object - no prose, no code fences."

export interface BoardCoordinatorOptions {
  readonly model: Model
  readonly instructions?: string
  readonly maxSteps?: number
}

export interface Coordinator {
  /** run a coordination session over one plain-text goal */
  readonly agent: AgentProgram<string, CoordinatorReplyType, AgentError, never>
}

export const makeCoordinator = (board: BoardApi, options: BoardCoordinatorOptions): Coordinator => {
  const driver = EffectAgent.make({
    model: options.model,
    instructions: options.instructions ?? COORDINATOR_INSTRUCTIONS,
    maxSteps: options.maxSteps ?? 12
  })
  const agent = Agent
    .define<string>("board.coordinator", (goal: string) => AgentContext.text(goal))
    .returns(Until.schema(CoordinatorReply))
    .writes(boardCoordinatorBinding(board))
    .implementedBy(driver)
  return { agent }
}

export interface BreakdownOptions {
  readonly model: Model
  readonly instructions?: string
  readonly maxSteps?: number
}

/** break down one goal item: run the coordinator over its title/body */
export const breakdownOf = (item: WorkItem): string =>
  "Goal item " + item.itemId + " - " + item.title + (item.body !== undefined ? "\n\n" + item.body : "") +
  (item.labels.length > 0 ? "\n\nlabels: " + item.labels.join(", ") : "")

/** effect running a coordination session to its reply */
export const coordinate = (
  board: BoardApi,
  itemId: string,
  options: BreakdownOptions
): Effect.Effect<{ ok: boolean; detail?: string; reply?: CoordinatorReplyType }> =>
  Effect.gen(function* () {
    const item = yield* board.getItem(itemId)
    if (item === undefined) return { ok: false, detail: "no such item" }
    yield* board.bus.push({ type: "coordinator.started", itemId, message: "coordinating " + item.title })
    const coordinator = makeCoordinator(board, options)
    return yield* coordinator.agent.run(breakdownOf(item)).pipe(
      Effect.map((reply) => ({ ok: reply.done, detail: reply.summary, reply })),
      Effect.catchAll((err) => Effect.succeed({ ok: false, detail: "coordination failed: " + err._tag }))
    ).pipe(
      Effect.tap((result) => (result.ok
        ? board.bus.push({ type: "coordinator.finished", itemId, message: "coordination done" })
        : Effect.void))
    )
  })
