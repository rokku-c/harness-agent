import { Effect } from "effect"
import { Codex, type CodexOptions, type ThreadOptions } from "@openai/codex-sdk"
import { AgentFailure, decode, type Driver, materialize, requireUntil, schemaJson, type RunRequest } from "../core.js"

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
        tools: "mcp", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated"
      },
      run: <A, R>(request: RunRequest<A, R>) => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.until)
        request = yield* materialize(request)
        const client = options.client ?? new Codex(options.clientOptions)
        const thread = options.resume
          ? client.resumeThread(options.resume, options.thread)
          : client.startThread(options.thread)
        const result = yield* Effect.tryPromise({
          try: () => thread.run(request.context.render(), request.until._tag === "Schema"
            ? { outputSchema: schemaJson(request.until.schema) as unknown as Record<string, unknown> }
            : undefined),
          catch: (cause) => new AgentFailure({ agent: driver.id, cause })
        })
        if (request.until._tag === "Schema") {
          let value: unknown
          try { value = JSON.parse(result.finalResponse) } catch (cause) {
            return yield* new AgentFailure({ agent: driver.id, cause })
          }
          return yield* decode(request.until.schema, value)
        }
        return result.finalResponse as A
      })
    }
    return driver
  }
}
