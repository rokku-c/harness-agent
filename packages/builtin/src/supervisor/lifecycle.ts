/**
 * supervisor/lifecycle.ts - the LIFECYCLE op surface: spawn with declared
 * watch rules, wait, and resume from a checkpoint.
 *
 * Concept: verbs over children as a whole - fork, join, revive. Direct
 * per-child messaging lives in supervisor/child-ops.ts.
 */
import { Effect, Schema } from "effect"
import { AgentRuntime, notationText, Op, type Watch } from "@effect-agent/core"

export const spawnOps = () => [
  Op.write({
    name: "spawn_agent",
    description: notationText("Spawn a named subagent with a task. Use watch rules to fork responders when the child reports at a declared moment."),
    input: Schema.Struct({
      agent: Schema.String,
      task: Schema.String,
      wait: Schema.optional(Schema.Boolean),
      watch: Schema.optional(Schema.Array(Schema.Struct({
        when: Schema.Struct({ kind: Schema.Literal("progress", "completed") }),
        spawn: Schema.Struct({ agent: Schema.String, task: Schema.String })
      })))
    }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const spec = input as {
          agent: string; task: string; wait?: boolean
          watch?: ReadonlyArray<{ when: { kind: "progress" | "completed" }; spawn: { agent: string; task: string } }>
        }
        const watch: ReadonlyArray<Watch> = (spec.watch ?? []).map((rule) => ({
          when: { kind: rule.when.kind },
          spawn: rule.spawn
        }))
        const spawned = yield* runtime.spawn(spec.agent, spec.task, watch)
        if (spec.wait) return yield* runtime.join(spawned.childId)
        return spawned
      })
  }),
  Op.read({
    name: "wait_children",
    description: notationText("Wait for spawned children. mode=all joins every child; mode=first returns when the first completes."),
    input: Schema.Struct({ mode: Schema.optional(Schema.Literal("all", "first")) }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.flatMap(AgentRuntime, (runtime) => {
        const { mode } = (input ?? {}) as { mode?: "all" | "first" }
        return runtime.wait(mode ?? "all")
      })
  }),
  Op.write({
    name: "resume_child",
    description: notationText("Resume a paused child from its checkpoint: the same agent starts hydrated from the archived thread; sensitivity-based recovery notes are injected first. Pass a new task to change the goal."),
    input: Schema.Struct({ runId: Schema.String, task: Schema.optional(Schema.String) }),
    output: Schema.Unknown,
    execute: (input: unknown) =>
      Effect.flatMap(AgentRuntime, (runtime) => {
        const { runId, task } = input as { runId: string; task?: string }
        return runtime.resume(runId, task)
      })
  })
]
