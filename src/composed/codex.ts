import { Effect } from "effect"
import { Codex, type CodexOptions, type ThreadOptions } from "@openai/codex-sdk"
import { AgentFailure, commitSchemaResult, decode, type Driver, materialize, requireUntil, schemaJson, type RunRequest } from "../core.js"

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
        // Honest declaration: the Codex SDK is turn-granular with no token/thinking
        // event stream, so the driver cannot expose Thinking (P1 candidate: extract
        // reasoning items from the Responses API, summary level only).
        provider: { _tag: "Fixed", api: "openai.codex" }, granularity: "turn", thinking: false,
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
          const output = yield* decode(request.until.schema, value)
          yield* commitSchemaResult(request, output, driver.id)
          return output
        }
        // P1 candidate (p0.md 5.6-1): extract reasoning-summary from Codex
        // Responses API reasoning items when thinking:true returns. Until then the
        // final response is the only observation level this driver exposes.
        return result.finalResponse as A
      })
    }
    return driver
  }
}
