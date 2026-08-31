/**
 * EffectAgent: the default self-driven loop, implemented in pure Effect-TS.
 * It receives the expressed loop (context, until, access) and runs the
 * canonical cycle: context -> model -> tool call -> binding op -> tool
 * result -> context -> until. Every driver-specific fact is in this file;
 * agent definitions never see it.
 */
import { Effect, Option, PubSub, Queue } from "effect"
import type { Capabilities } from "@effect-agent/core"
import { AgentFailure, AgentSession, materialize, requireUntil, decode, decodeJson, schemaJson, type AgentEvent, type Driver, type Op, type RunRequest } from "@effect-agent/core"
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
          // the live session, when running under the runtime: signal box in,
          // event bus out. A sessionless run behaves exactly as before.
          const session = yield* Effect.serviceOption(AgentSession)
          const agentName = Option.isSome(session) ? session.value.agent : driver.id
          const emit = (event: AgentEvent) =>
            Option.isSome(session) ? Effect.asVoid(PubSub.publish(session.value.events, event)) : Effect.void

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
          yield* emit({ _tag: "Step", agent: agentName, step: 0 })
          const maxSteps = options.maxSteps ?? 32

          for (let step = 0; step < maxSteps; step++) {
            // cooperative scheduling: yield between steps so supervisors,
            // watchers and interruptions get their turn
            yield* Effect.yieldNow()
            // drain the signal box at the step boundary: injections land in
            // the context, interrupts end the run cooperatively
            if (Option.isSome(session)) {
              const pending = yield* Queue.takeAll(session.value.signals)
              for (const signal of pending) {
                if (signal._tag === "Interrupt")
                  return yield* new AgentFailure({ agent: driver.id, cause: "interrupted by signal" })
                context = context.append(...signal.content)
                thread.push({ role: "user", content: new (context.constructor as any)(signal.content).render() })
              }
            }
            const result = yield* options.model
              .generate(options.instructions ?? "", thread, tools)
              .pipe(Effect.mapError((cause) => new AgentFailure({ agent: driver.id, cause })))

            yield* emit({ _tag: "Step", agent: agentName, step: step + 1 })
            const calls = result.toolCalls ?? []
            if (calls.length > 0 && request.until._tag !== "ToolCall") {
              thread.push({ role: "assistant", content: result.text, toolCalls: calls })
              for (const call of calls) {
                const op = byName.get(call.name)
                // every failure mode below is a TOOL ERROR fed back to the
                // model as a result - the model can self-correct instead of
                // the run dying; only the until boundary ends the run
                const toolError = (detail: string) =>
                  Effect.gen(function* () {
                    const text = call.name + " error: " + detail
                    thread.push({ role: "tool", id: call.id, name: call.name, content: text })
                    context = context.append({ _tag: "ToolResult", id: call.id, name: call.name, output: { error: text } })
                    yield* emit({ _tag: "ToolResult", agent: agentName, tool: call.name, output: { error: text } })
                  })
                if (op === undefined) {
                  yield* toolError("unknown tool " + call.name)
                  continue
                }
                yield* emit({ _tag: "ToolUse", agent: agentName, tool: call.name, input: call.input })
                // decode the model's raw JSON against the op's Schema: the op
                // sees typed input, a bad call becomes a recoverable error
                const outcome = yield* decode(op.input, call.input).pipe(
                  Effect.mapError((error) => ({ ok: false as const, detail: JSON.stringify(error.cause).slice(0, 400) })),
                  Effect.flatMap((input) =>
                    op.execute(input as never).pipe(
                      Effect.map((output) => ({ ok: true as const, output })),
                      Effect.mapError((error) => {
                        const inner = (error as { cause?: unknown })?.cause
                        return { ok: false as const, detail: inner !== undefined ? String(inner) : String(error) }
                      })
                    )
                  ),
                  Effect.catchAll((failure) => Effect.succeed(failure))
                )
                if (!outcome.ok) {
                  yield* toolError(outcome.detail)
                  continue
                }
                yield* emit({ _tag: "ToolResult", agent: agentName, tool: call.name, output: outcome.output })
                thread.push({ role: "tool", id: call.id, name: call.name, content: JSON.stringify(outcome.output) })
                context = context.append({ _tag: "ToolResult", id: call.id, name: call.name, output: outcome.output })
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




