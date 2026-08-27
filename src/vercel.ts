import { Effect, Runtime } from "effect"
import { Output, generateText, jsonSchema, tool, type LanguageModel, type ToolSet } from "ai"
import { AgentFailure, commitSchemaResult, type Driver, materialize, requireUntil, schemaJson, type RunRequest } from "./core.js"

export interface VercelOptions {
  readonly model: LanguageModel
  readonly api?: string
  readonly instructions?: string
  readonly maxSteps?: number
  /** Vercel LanguageModel does not expose model output limits, so the default is 8192. */
  readonly maxOutputTokens?: number
}

const makeTools = (request: RunRequest<any, any>, runtime: Runtime.Runtime<any>): ToolSet =>
  Object.fromEntries(request.access.flatMap(({ binding, write }) =>
    (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op) => [op.name, tool({
      description: op.description,
      inputSchema: jsonSchema(schemaJson(op.input) as any),
      execute: async (input: unknown) => Runtime.runPromise(runtime)(op.execute(input))
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
      run: <A, R>(request: RunRequest<A, R>) => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.until)
        request = yield* materialize(request)
        const runtime = yield* Effect.runtime<any>()
        const tools = makeTools(request, runtime)
        const result = yield* Effect.tryPromise({
          try: () => generateText({
            model: options.model,
            instructions: options.instructions,
            prompt: request.context.render(),
            tools,
            maxOutputTokens: options.maxOutputTokens ?? 8192,
            stopWhen: ({ steps }) => steps.length >= (options.maxSteps ?? 32),
            ...(request.until._tag === "Schema" ? {
              output: Output.object({ schema: jsonSchema(schemaJson(request.until.schema) as any) })
            } : {})
          }),
          catch: (cause) => new AgentFailure({ agent: driver.id, cause })
        })
        switch (request.until._tag) {
          case "Stop": return result.text as A
          case "Text": return result.text as A
          case "Thinking": return (result.finalStep.reasoningText ?? "") as A
          case "ToolCall": {
            // P1: enable once the unified event/pause protocol lands. Until then
            // requireUntil rejects Until.toolCall (toolCalls: "observe"), so this
            // branch is unreachable through negotiation and must not be advertised.
            const call = result.toolCalls[0]
            if (!call) return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
            return { _tag: "ToolCall", id: call.toolCallId, name: call.toolName, input: call.input } as A
          }
          case "Schema": {
            const output = result.output as A
            yield* commitSchemaResult(request, output, driver.id)
            return output
          }
        }
      }).pipe(Effect.scoped)
    }
    return driver
  }
}
