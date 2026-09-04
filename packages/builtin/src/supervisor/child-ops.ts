/**
 * supervisor/child-ops.ts - DIRECT-TO-CHILD ops.
 *
 * Concept: verbs over ONE running child - inject into its context, stop it
 * (cooperative or hard), or checkpoint it for later resume. Forking and
 * joining whole children live in supervisor/lifecycle.ts.
 */
import { Effect, Schema } from "effect"
import { AgentRuntime, notationText, Op } from "@effect-agent/core"

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
  }),
  Op.write({
    name: "pause_child",
    description: notationText("Checkpoint a running child at its next step boundary and pause it; resume it later with resume_child using the returned run id."),
    input: Schema.Struct({ child: Schema.String }),
    output: Schema.Struct({ pauseRequested: Schema.Boolean }),
    execute: (input: unknown) =>
      Effect.gen(function* () {
        const runtime = yield* AgentRuntime
        const { child } = input as { child: string }
        yield* runtime.pause(child)
        return { pauseRequested: true }
      })
  })
]
