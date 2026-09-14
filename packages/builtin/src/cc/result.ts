import { Effect } from "effect"
import { AgentFailure, decode, type Until } from "@effect-agent/core"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"

export const interpretResult = <A>(
  agentId: string,
  until: Until<A>,
  messages: ReadonlyArray<SDKMessage>
): Effect.Effect<A, AgentFailure> =>
  Effect.gen(function* () {
    const result = messages.findLast((message) => message.type === "result")
    if (!result || result.subtype !== "success")
      return yield* new AgentFailure({ agent: agentId, cause: result ?? "No result" })
    if (until._tag === "Schema") {
      const structured = (result as { structured_output?: unknown }).structured_output
      return yield* Effect.mapError(decode(until.schema, structured), (cause) =>
        new AgentFailure({ agent: agentId, cause })
      ) as Effect.Effect<A, AgentFailure>
    }
    if (until._tag === "Stop" || until._tag === "Text") return result.result as A
    const assistant = messages.findLast((message) => message.type === "assistant")
    const blocks = ((assistant?.message?.content ?? []) as unknown) as Array<{ type: string; thinking?: string; id?: string; name?: string; input?: unknown }>
    if (until._tag === "Thinking") {
      const thinking = blocks.find((block) => block.type === "thinking")
      return ((thinking && thinking.thinking) || "") as A
    }
    const call = blocks.find((block) => block.type === "tool_use")
    if (!call || !call.id || !call.name)
      return yield* new AgentFailure({ agent: agentId, cause: "No tool call produced" })
    return { _tag: "ToolCall", id: call.id, name: call.name, input: call.input } as A
  })
