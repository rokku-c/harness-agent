import { Effect, Runtime } from "effect"
import { Output, generateText, jsonSchema, tool, type LanguageModel, type ToolSet } from "ai"
import { AgentFailure, toolErrorJson, type Driver, schemaJson, type RunRequest } from "./core.js"
import { runToCompletion } from "./driver.js"

export interface VercelOptions {
  readonly model: LanguageModel
  readonly api?: string
  readonly instructions?: string
  readonly maxSteps?: number
  /** Vercel LanguageModel does not expose model output limits, so the default is 8192. */
  readonly maxOutputTokens?: number
}

const makeTools = (request: RunRequest<any, any>, runtime: Runtime.Runtime<any>, onFatal?: (cause: unknown) => void): ToolSet =>
  Object.fromEntries(request.access.flatMap(({ binding, write }) =>
    (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op) => [op.name, tool({
      description: op.description,
      inputSchema: jsonSchema(schemaJson(op.input) as any),
      // B3b: a failing op becomes a structured tool result the model can see and
      // retry - never a thrown execute that kills the turn. With onError: "fail"
      // the error propagates so the run fails as an AgentFailure instead.
      execute: async (input: unknown) => {
        try {
          return await Runtime.runPromise(runtime)(op.execute(input))
        } catch (cause) {
          if (op.onError === "fail") {
            // The ai SDK swallows a throwing execute and hands the model an
            // error-text part, so the run records the failure and turns it into
            // an AgentFailure after generateText settles.
            onFatal?.(cause)
            throw cause
          }
          return toolErrorJson(cause)
        }
      }
    })])))

export const VercelAgent = {
  make: (options: VercelOptions): Driver => {
    const driver: Driver = {
      id: "vercel",
      capabilities: {
        provider: options.api
          ? { _tag: "Fixed", api: options.api }
          : { _tag: "Configurable" },
        granularity: "event", thinking: true,
        cancel: true, pause: false, resume: false, fork: "node",
        tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated"
      },
      run: <A, R>(request: RunRequest<A, R>) => runToCompletion(request, {
        id: driver.id,
        capabilities: driver.capabilities,
        generate: (materialized) => Effect.gen(function*() {
          const runtime = yield* Effect.runtime<any>()
          let fatal: unknown
          const tools = makeTools(materialized, runtime, (cause) => { fatal = cause })
          const result = yield* Effect.tryPromise({
            try: () => generateText({
              model: options.model,
              instructions: options.instructions,
              prompt: materialized.context.render(),
              tools,
              maxOutputTokens: options.maxOutputTokens ?? 8192,
              stopWhen: ({ steps }) => steps.length >= (options.maxSteps ?? 32),
              ...(materialized.until._tag === "Schema" ? {
                output: Output.object({ schema: jsonSchema(schemaJson(materialized.until.schema) as any) })
              } : {})
            }),
            catch: (cause) => new AgentFailure({ agent: driver.id, cause })
          })
          // onError: "fail" escape hatch: the op failure must fail the run even
          // though the ai SDK turned the thrown execute into a tool-error part.
          if (fatal !== undefined)
            return yield* new AgentFailure({ agent: driver.id, cause: fatal })
          // B4: the skeleton reports the usage carried on the result exactly
          // once (ai 7.0.65 runtime already aggregates generateText usage into
          // { inputTokens, outputTokens, totalTokens } - never read .total).
          const usage = {
            inputTokens: result.usage?.inputTokens ?? null,
            outputTokens: result.usage?.outputTokens ?? null,
            // LanguageModel is a string literal union or a v2-v4 object with a
            // modelId; both carry the model identity.
            model: typeof options.model === "string" ? options.model : options.model?.modelId ?? null
          }
          switch (materialized.until._tag) {
            case "Thinking":
              return { raw: result.text, reasoningText: result.finalStep.reasoningText ?? "" }
            case "ToolCall":
              // P1: enable once the unified event/pause protocol lands. Until then
              // requireUntil rejects Until.toolCall (toolCalls: "observe"), so this
              // branch is unreachable through negotiation and must not be advertised.
              {
                const call = result.toolCalls[0]
                return {
                  raw: result.text,
                  toolCall: call
                    ? { _tag: "ToolCall", id: call.toolCallId, name: call.toolName, input: call.input }
                    : undefined
                }
              }
            case "Schema":
              // Output.object already decoded; the skeleton re-decodes (idempotent
              // for the plain value) and commits uniformly.
              return { raw: result.output, usage }
            default:
              return { raw: result.text, usage }
          }
        })
      }).pipe(Effect.scoped)
    }
    return driver
  }
}
