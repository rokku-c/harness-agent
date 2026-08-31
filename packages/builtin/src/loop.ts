/**
 * EffectAgent: the default self-driven loop, implemented in pure Effect-TS.
 * It receives the expressed loop (context, until, access) and runs the
 * canonical cycle: context -> model -> tool call -> binding op -> tool
 * result -> context -> until. Every driver-specific fact is in this file;
 * agent definitions never see it.
 */
import { Effect } from "effect"
import type { Capabilities } from "@effect-agent/core"
import { AgentFailure, materialize, requireUntil, decodeJson, schemaJson, type Driver, type Op, type RunRequest } from "@effect-agent/core"
import type { Model, WireMessage, WireTool, WireToolCall } from "./wire.ts"

export interface EffectAgentOptions {
  readonly model: Model
  /** The system prompt: the driver's only model-facing prose, supplied by the operator. */
  readonly instructions?: string
  readonly maxSteps?: number
}

export const EffectAgent = {
  make: (options: EffectAgentOptions): Driver => {
    const driver: Driver = {
      id: "effect-agent",
      capabilities: {
        provider: { _tag: "Configurable" },
        granularity: "run",
        thinking: false,
        cancel: true,
        // the loop honors the requested boundary: Until.text/toolCall/schema
        // each stop the run and return - that is pausing at the boundary
        pause: true,
        resume: false,
        fork: "none",
        tools: "native",
        toolCalls: "intercept",
        structuredOutput: "text",
        sandbox: "none"
      },
      run: <A, R>(request: RunRequest<A, R>) =>
        Effect.gen(function* () {
          const unsupported = requireUntil(driver.id, driver.capabilities, request.until)
          if (unsupported) return yield* Effect.fail(unsupported)
          const prepared = yield* materialize(request)

          // flatten access into the wire tool surface: read ops always, write
          // ops only where write access was granted
          const ops: Array<Op<any, any, any, any>> = prepared.access.flatMap(({ binding, write }) =>
            (binding.ops ?? []).filter((op) => op.access === "read" || write)
          )
          const tools: ReadonlyArray<WireTool> = ops.map((op) => ({
            name: op.name,
            description: op.description,
            input: schemaJson(op.input)
          }))
          const byName = new Map(ops.map((op) => [op.name, op]))

          // the thread is the provider-side view of the context
          let context = prepared.context
          const thread: Array<WireMessage> = [{ role: "user", content: context.render() }]
          const maxSteps = options.maxSteps ?? 32

          for (let step = 0; step < maxSteps; step++) {
            const result = yield* options.model
              .generate(options.instructions ?? "", thread, tools)
              .pipe(Effect.mapError((cause) => new AgentFailure({ agent: driver.id, cause })))

            const calls = result.toolCalls ?? []
            if (calls.length > 0 && request.until._tag !== "ToolCall") {
              thread.push({ role: "assistant", content: result.text, toolCalls: calls })
              for (const call of calls) {
                const op = byName.get(call.name)
                if (op === undefined)
                  return yield* new AgentFailure({ agent: driver.id, cause: "model called unknown op: " + call.name })
                const output = yield* op.execute(call.input).pipe(
                  Effect.mapError((cause) => new AgentFailure({ agent: driver.id, cause: call.name + " failed: " + String(cause) }))
                )
                thread.push({ role: "tool", id: call.id, name: call.name, content: JSON.stringify(output) })
                context = context.append({ _tag: "ToolResult", id: call.id, name: call.name, output })
              }
              continue
            }

            switch (request.until._tag) {
              case "Text":
              case "Stop":
                return result.text as A
              case "ToolCall": {
                const call: WireToolCall | undefined = calls[0]
                if (call === undefined)
                  return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
                return { _tag: "ToolCall", id: call.id, name: call.name, input: call.input } as A
              }
              case "Schema": {
                const decoded = yield* decodeJson(request.until.schema, result.text).pipe(
                  Effect.mapError((cause) => new AgentFailure({ agent: driver.id, cause }))
                )
                return decoded as A
              }
              case "Thinking":
                return yield* new AgentFailure({ agent: driver.id, cause: "thinking not exposed" })
            }
          }
          return yield* new AgentFailure({ agent: driver.id, cause: "exceeded " + maxSteps + " steps" })
        }).pipe(Effect.scoped) as any
    }
    return driver
  }
}


