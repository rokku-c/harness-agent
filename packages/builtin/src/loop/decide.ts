/**
 * loop/decide.ts - TERMINATION SEMANTICS.
 *
 * Concept: a turn that produced no executable tool calls ends the run the
 * way the agent declared (until). Text/Stop return the text; ToolCall
 * returns the first call; Thinking is not exposed. A Schema result that was
 * NOT delivered as the protocol tool is the legacy path: plain-text JSON is
 * accepted silently when it decodes, otherwise the run fails cleanly with
 * the readable cause - one attempt, no fabricated user retry prompts.
 */
import { Effect } from "effect"
import { AgentFailure, decodeJson, type Until } from "@effect-agent/core"
import type { WireToolCall } from "../wire.ts"

export const decide = <A>(
  agentId: string,
  until: Until<A>,
  resultText: string,
  calls: ReadonlyArray<WireToolCall>
): Effect.Effect<A, AgentFailure> =>
  Effect.gen(function* () {
    switch (until._tag) {
      case "Text":
      case "Stop":
        return resultText as A
      case "ToolCall": {
        const call = calls[0]
        if (call === undefined)
          return yield* Effect.fail(new AgentFailure({ agent: agentId, cause: "No tool call produced" }))
        return { _tag: "ToolCall", id: call.id, name: call.name, input: call.input } as A
      }
      case "Schema": {
        const decoded = yield* decodeJson(until.schema, resultText).pipe(Effect.either)
        if (decoded._tag === "Left") {
          const raw = decoded.left as { cause?: unknown }
          const expected = until.asTool !== undefined
            ? "expected a " + until.asTool.name + " tool call carrying the structured result; "
            : ""
          return yield* Effect.fail(new AgentFailure({
            agent: agentId,
            cause: expected + "the plain-text reply did not decode: " + JSON.stringify(raw.cause).slice(0, 200)
          }))
        }
        return decoded.right as A
      }
      case "Thinking":
        return yield* Effect.fail(new AgentFailure({ agent: agentId, cause: "thinking not exposed" }))
    }
  })
