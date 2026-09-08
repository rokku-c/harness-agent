/**
 * loop/decide.ts - TERMINATION SEMANTICS.
 *
 * Concept: a turn that produced no executable tool calls ends the run the
 * way the agent declared (until). Text/Stop return the text; ToolCall
 * returns the first call; Thinking is not exposed. Structured results must
 * arrive through the declared protocol tool, never through reply text.
 */
import { Effect } from "effect"
import { AgentFailure, type Until } from "@effect-agent/core"
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
      case "Schema":
        return yield* Effect.fail(new AgentFailure({
          agent: agentId,
          cause: "Structured result requires the declared asTool tool call; plain-text replies are not accepted"
        }))
      case "Thinking":
        return yield* Effect.fail(new AgentFailure({ agent: agentId, cause: "thinking not exposed" }))
    }
  })
