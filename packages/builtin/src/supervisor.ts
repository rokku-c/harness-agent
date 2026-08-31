/**
 * The supervisor's capability surface, composed from layered op factories.
 * A binding is data: include the whole surface (runtimeBinding), or just the
 * slice a child may have (childBinding) - least privilege is composition,
 * not a policy filter.
 */
import { Effect, Schema } from "effect"
import {
  AgentRegistry, AgentRuntime, Boards, Groups, notationText, Op,
  type Binding, type Watch
} from "@effect-agent/core"
import { boardOps } from "./boards.ts"
import { groupOps } from "./groups.ts"
import { progressOp } from "./signals.ts"

/** Supervision ops: fork children with declared watch rules, then join. */
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
  })
]

/** Direct-to-child ops: inject into or end a running child's context. */
export const signalOps = () => [
  Op.write({
    name: "send_child",
    description: notationText("Inject a message into a running child's context; it takes effect at the child's next step."),
    input: Schema.Struct({ child: Schema.String, text: Schema.String }),
    output: Schema.Struct({ sent: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const { child, text } = input as { child: string; text: string }
        yield* runtime.send(child, { _tag: "Inject", content: [{ _tag: "Text", text }] })
        return { sent: true }
      })
  }),
  Op.write({
    name: "interrupt_child",
    description: notationText("Stop a running child. Cooperative mode lets it finish its current step; hard mode kills the fiber."),
    input: Schema.Struct({ child: Schema.String, hard: Schema.optional(Schema.Boolean) }),
    output: Schema.Struct({ interrupted: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const { child, hard } = input as { child: string; hard?: boolean }
        yield* runtime.interrupt(child, hard ?? false)
        return { interrupted: true }
      })
  })
]

/** The full supervision surface, for an orchestrating agent. */
export const runtimeBinding: Binding<any, any, AgentRuntime | AgentRegistry | Boards | Groups> = {
  uri: "ea://runtime/agents",
  // the roster, materialized into the supervisor's context at run start, so
  // the model spawns names that actually exist
  read: Effect.map(AgentRegistry, (registry) => ({
    _tag: "Text" as const,
    text: "Registered agents you may spawn: " + (registry.names().join(", ") || "(none)")
  })),
  ops: [...spawnOps(), ...signalOps(), ...groupOps(), ...boardOps(), progressOp()]
}

/** The least-privilege child surface: boards and progress, nothing else. */
export const childBinding: Binding<any, any, Boards> = {
  uri: "ea://runtime/child",
  ops: [...boardOps(), progressOp()]
}

