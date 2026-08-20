import { Effect } from "effect"
import { Codex, type CodexOptions, type ThreadOptions } from "@openai/codex-sdk"
import { AgentFailure, decode, type AgentError, type Driver, materialize, requireSubagents, requireUntil, schemaJson, type DriverContext, type DriverSession, type StepEvent } from "@effect-agent/core"

export interface CodexAgentOptions {
  readonly client?: Codex
  readonly clientOptions?: CodexOptions
  readonly thread?: ThreadOptions
  readonly resume?: string
}

export const CodexAgent = {
  make: (options: CodexAgentOptions = {}): Driver => {
    const driver: Driver = {
      id: "codex",
      capabilities: {
        provider: { _tag: "Fixed", api: "openai.codex" }, granularity: "turn", thinking: true,
        cancel: true, pause: false, resume: true, fork: "none",
        tools: "mcp", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated", subagents: false
      },
      start: (request: DriverContext): Effect.Effect<DriverSession, AgentError, never> => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.context.until)
        yield* requireSubagents(driver.id, driver.capabilities, request.context.subagents)
        request = yield* materialize(request)
        const client = options.client ?? new Codex(options.clientOptions)
        const thread = options.resume
          ? client.resumeThread(options.resume, options.thread)
          : client.startThread(options.thread)
        const until = request.context.until
        const execute = Effect.tryPromise({
          try: () => thread.run([
            request.context.renderSystem(),
            request.context.render()
          ].filter(Boolean).join("\n\n"), until?._tag === "Schema"
            ? { outputSchema: schemaJson(until.schema) as unknown as Record<string, unknown> }
            : undefined),
          catch: (cause) => new AgentFailure({ agent: driver.id, cause })
        }).pipe(Effect.flatMap((result) => Effect.gen(function*() {
          if (until?._tag === "Schema") {
            let value: unknown
            try { value = JSON.parse(result.finalResponse) } catch (cause) {
              return yield* new AgentFailure({ agent: driver.id, cause })
            }
            return yield* decode(until.schema, value)
          }
          return result.finalResponse
        })))
        return {
          step: execute.pipe(Effect.map((value) => ({ _tag: "Result", value }) as StepEvent))
        }
      }) as Effect.Effect<DriverSession, AgentError, never>
    }
    return driver
  }
}
