/**
 * Batch combinators: map / filter over children, learned from collection
 * algebra. map_children is a bounded parallel map (one declaration fans out
 * N children); children_where is filter; the reduce is deliberately NOT an
 * op - a board is the accumulator (post_board folds, read_board finalizes)
 * and small result sets reduce in the supervisor's context. All of it
 * composes from the supervision kernel - no kernel changes.
 */
import { Effect, Schema } from "effect"
import { AgentRuntime, notationText, Op } from "@effect-agent/core"

export const batchOps = () => [
  Op.write({
    name: "map_children",
    description: notationText("Fan out: spawn the SAME named agent once per task, at most 'concurrency' children running at a time. With join=true (default) this is a parallel map - one call returns every child's result. Merge small result sets in your final text; for large ones, have children post to a board and read_board afterwards."),
    input: Schema.Struct({
      agent: Schema.String,
      tasks: Schema.Array(Schema.String),
      concurrency: Schema.optional(Schema.Number),
      join: Schema.optional(Schema.Boolean)
    }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const { agent, tasks, concurrency, join } = input as {
          agent: string; tasks: ReadonlyArray<string>; concurrency?: number; join?: boolean
        }
        if (join === false)
          return yield* Effect.forEach(tasks, (task) => runtime.spawn(agent, task), { concurrency: concurrency ?? 8 })
        return yield* Effect.forEach(
          tasks,
          (task) => Effect.flatMap(runtime.spawn(agent, task), (spawned) => runtime.join(spawned.childId)),
          { concurrency: concurrency ?? 8 }
        )
      })
  }),
  Op.read({
    name: "children_where",
    description: notationText("Filter your children by agent name and/or status (running/completed/failed/interrupted). Act on the matches with send_child or interrupt_child."),
    input: Schema.Struct({
      agent: Schema.optional(Schema.String),
      status: Schema.optional(Schema.Literal("running", "completed", "failed", "interrupted"))
    }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const { agent, status } = (input ?? {}) as { agent?: string; status?: "running" | "completed" | "failed" | "interrupted" }
        const all = yield* runtime.children
        return all.filter((child) =>
          (agent === undefined || child.agent === agent) && (status === undefined || child.status === status)
        )
      })
  })
]

