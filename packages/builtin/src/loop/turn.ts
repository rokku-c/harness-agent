import { Effect } from "effect"
import { AgentFailure, decode, type Op } from "@effect-agent/core"
import type { RunBox } from "./types.ts"
import type { FinalTool } from "./protocol.ts"
import { causeDetail, feedBack, runOp, type FeedbackEnv } from "./execute.ts"
import type { WireToolCall } from "@effect-agent/model"

export interface TurnEnv extends FeedbackEnv {
  readonly driverId: string
  readonly byName: Map<string, Op<any, any, any, any>>
  readonly visible: Set<string>
  readonly finalTool?: FinalTool
  readonly decodeRetries: number
}

export type CallsOutcome<A> =
  | { readonly _tag: "Return"; readonly value: A }
  | { readonly _tag: "Continue" }

export const runTurnCalls = <A>(
  env: TurnEnv,
  box: RunBox,
  calls: ReadonlyArray<WireToolCall>
): Effect.Effect<CallsOutcome<A>, AgentFailure, any> =>
  Effect.gen(function* () {
    for (const call of calls) {
      if (env.finalTool !== undefined && call.name === env.finalTool.name) {
        const decoded = yield* decode(env.finalTool.schema as never, call.input).pipe(
          Effect.map((value) => ({ ok: true as const, value })),
          Effect.mapError((error) => ({ ok: false as const, detail: causeDetail(error) })),
          Effect.catchAll((failure) => Effect.succeed(failure))
        )
        if (decoded.ok) return { _tag: "Return", value: decoded.value as A }
        if (box.retries >= env.decodeRetries)
          return yield* Effect.fail(new AgentFailure({ agent: env.driverId, cause: decoded.detail }))
        box.retries += 1
        yield* feedBack(env, box, call, decoded.detail)
        continue
      }
      const op = env.byName.get(call.name)
      if (op === undefined) {
        yield* feedBack(env, box, call, "unknown tool " + call.name)
        continue
      }
      if (!env.visible.has(call.name)) {
        yield* feedBack(env, box, call, call.name + " is not active in the current tool surface - discover or enable it first")
        continue
      }
      yield* env.emit({ _tag: "ToolUse", agent: env.agentName, tool: call.name, input: call.input })
      const outcome = yield* runOp(op, call.input)
      if (!outcome.ok) {
        yield* feedBack(env, box, call, outcome.detail)
        continue
      }
      box.usedTools.push(op.name)
      yield* env.emit({ _tag: "ToolResult", agent: env.agentName, tool: call.name, output: outcome.output })
      box.thread.push({ role: "tool", id: call.id, name: call.name, content: JSON.stringify(outcome.output) })
      box.context = box.context.append({ _tag: "ToolResult", id: call.id, name: call.name, output: outcome.output })
    }
    return { _tag: "Continue" }
  })
