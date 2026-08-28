import { Effect, Runtime } from "effect"
import { createAgentSession, type CreateAgentSessionOptions, type ToolDefinition } from "@mariozechner/pi-coding-agent"
import { AgentFailure, toolErrorJson, type Driver, schemaJson, type RunRequest } from "../core.js"
import { runToCompletion } from "../driver.js"

export interface PiOptions extends CreateAgentSessionOptions {
  readonly createSession?: typeof createAgentSession
}

const textOf = (message: any) => Array.isArray(message?.content)
  ? message.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("")
  : ""

export const PiAgent = {
  make: (options: PiOptions = {}): Driver => {
    const driver: Driver = {
      id: "pi",
      capabilities: {
        // usage: pi-coding-agent exposes no token-usage surface on its session
        // prompt results, so this driver never emits UsageReported (B4).
        provider: { _tag: "Configurable" }, granularity: "event", thinking: true,
        cancel: true, pause: false, resume: true, fork: "node",
        tools: "native", toolCalls: "observe", structuredOutput: "tool", sandbox: "none"
      },
      run: <A, R>(request: RunRequest<A, R>) => runToCompletion(request, {
        id: driver.id,
        capabilities: driver.capabilities,
        generate: (materialized) => Effect.gen(function*() {
          const runtime = yield* Effect.runtime<any>()
          const { createSession = createAgentSession, ...sessionOptions } = options
          const outputName = "effect_agent_return"
          let object: unknown
          const outputTool: ToolDefinition | undefined = materialized.until._tag === "Schema" ? {
            name: outputName,
            label: "Return structured output",
            description: "Return the final answer using this tool exactly once.",
            parameters: schemaJson(materialized.until.schema) as any,
            execute: async (_id, input) => {
              object = input
              return { content: [{ type: "text", text: "Output accepted." }], details: input, terminate: true }
            }
          } : undefined
          const ops: ToolDefinition[] = materialized.access.flatMap(({ binding, write }) =>
            (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op): ToolDefinition => ({
              name: op.name,
              label: op.name,
              description: op.description,
              parameters: schemaJson(op.input) as any,
              // B3b: a failing op becomes a structured tool result instead of
              // rejecting the prompt call and aborting the run. With onError: "fail"
              // the error propagates so the run fails as an AgentFailure instead.
              execute: async (_id, input) => {
                let text: string
                try {
                  text = JSON.stringify(await Runtime.runPromise(runtime)(op.execute(input)))
                } catch (cause) {
                  if (op.onError === "fail") throw cause
                  text = toolErrorJson(cause)
                }
                return { content: [{ type: "text", text }], details: undefined }
              }
            })))
          const { session } = yield* Effect.tryPromise({
            try: () => createSession({
              ...sessionOptions,
              customTools: [...(sessionOptions.customTools ?? []), ...ops, ...(outputTool ? [outputTool] : [])]
            }),
            catch: (cause) => new AgentFailure({ agent: driver.id, cause })
          })
          yield* Effect.addFinalizer(() => Effect.promise(() => session.abort()).pipe(Effect.ignore))
          yield* Effect.tryPromise({
            try: () => session.prompt(materialized.context.render() + (outputTool ? `\nFinish by calling ${outputName}.` : "")),
            catch: (cause) => new AgentFailure({ agent: driver.id, cause })
          })
          if (materialized.until._tag === "Schema") {
            if (object === undefined)
              return yield* new AgentFailure({ agent: driver.id, cause: "Structured output tool was not called" })
            // the skeleton decodes + commits uniformly; the old decodeJson JSON-text
            // round-trip resolves to the same value decode
            return { raw: object }
          }
          const assistant = session.messages.findLast((message: any) => message.role === "assistant") as any
          if (materialized.until._tag === "Thinking") {
            return {
              raw: textOf(assistant),
              reasoningText: assistant?.content?.find((part: any) => part.type === "thinking")?.thinking ?? ""
            }
          }
          if (materialized.until._tag === "ToolCall") {
            const call = assistant?.content?.find((part: any) => part.type === "toolCall")
            return {
              raw: textOf(assistant),
              toolCall: call
                ? { _tag: "ToolCall", id: call.id, name: call.name, input: call.arguments }
                : undefined
            }
          }
          return { raw: textOf(assistant) }
        })
      }).pipe(Effect.scoped)
    }
    return driver
  }
}
