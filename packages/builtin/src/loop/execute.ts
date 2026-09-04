/**
 * loop/execute.ts - TOOL PRIMITIVES: decode, run, and feed a result back.
 *
 * Concept: the atomic act of one op call. A model tool call is decoded
 * against the op's schema, executed, and the outcome is reduced to a
 * readable { ok } - plus feedBack, which writes a failure into the thread,
 * the context and the event bus exactly like a provider tool result, so the
 * model can self-correct on the next step.
 */
import { Effect } from "effect"
import { decode, type AgentEvent, type Op } from "@effect-agent/core"
import type { RunBox } from "./types.ts"
import type { WireToolCall } from "../wire.ts"

/** readable failure detail for one decode/execute error */
export const causeDetail = (error: unknown): string => {
  const cause = (error as { cause?: unknown })?.cause
  return JSON.stringify(cause ?? error).slice(0, 400)
}

export interface FeedbackEnv {
  readonly agentName: string
  readonly emit: (event: AgentEvent) => Effect.Effect<void>
}

/** decoded + executed outcome of one call against one op */
export const runOp = <O>(op: Op<any, O, any, any>, input: unknown): Effect.Effect<{ ok: true; output: O } | { ok: false; detail: string }, never, any> =>
  decode(op.input as never, input).pipe(
    Effect.mapError((error) => ({ ok: false as const, detail: causeDetail(error) })),
    Effect.flatMap((typed) =>
      op.execute(typed as never).pipe(
        Effect.map((output) => ({ ok: true as const, output })),
        Effect.mapError((error) => {
          const inner = (error as { cause?: unknown })?.cause
          return { ok: false as const, detail: inner !== undefined ? String(inner) : String(error) }
        })
      )
    ),
    Effect.catchAll((failure) => Effect.succeed(failure))
  )

/** put a tool failure back as the model's next input (tool role message) */
export const feedBack = (env: FeedbackEnv, box: RunBox, call: WireToolCall, detail: string): Effect.Effect<void, never, any> =>
  Effect.gen(function* () {
    const text = call.name + " error: " + detail
    box.lastToolError = detail
    box.thread.push({ role: "tool", id: call.id, name: call.name, content: text })
    box.context = box.context.append({ _tag: "ToolResult", id: call.id, name: call.name, output: { error: text } })
    yield* env.emit({ _tag: "ToolResult", agent: env.agentName, tool: call.name, output: { error: text } })
  })
