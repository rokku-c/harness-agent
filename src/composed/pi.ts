import { Effect, Runtime } from "effect"
import { createAgentSession, type CreateAgentSessionOptions, type ToolDefinition } from "@mariozechner/pi-coding-agent"
import { AgentFailure, decodeJson, type AgentError, type Driver, materialize, requireSubagents, requireUntil, schemaJson, toolName, type DriverContext, type DriverSession, type StepEvent } from "../core.js"

export interface PiOptions extends CreateAgentSessionOptions {
  readonly createSession?: typeof createAgentSession
  /** Prefix applied to injected tool names. Default no prefix. `false` means no prefix. */
  readonly toolPrefix?: string | false
}

const textOf = (message: any) => Array.isArray(message?.content)
  ? message.content.filter((part: any) => part.type === "text").map((part: any) => part.text).join("")
  : ""

export const PiAgent = {
  make: (options: PiOptions = {}): Driver => {
    const driver: Driver = {
      id: "pi",
      capabilities: {
        provider: { _tag: "Configurable" }, granularity: "event", thinking: true,
        cancel: true, pause: false, resume: true, fork: "node",
        tools: "native", toolCalls: "observe", structuredOutput: "tool", sandbox: "none", subagents: false
      },
      start: (request: DriverContext): Effect.Effect<DriverSession, AgentError, never> => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.context.until)
        yield* requireSubagents(driver.id, driver.capabilities, request.context.subagents)
        request = yield* materialize(request)
        const { createSession = createAgentSession, ...sessionOptions } = options
        const prefix = options.toolPrefix ?? ""
        const outputName = toolName("effect_agent_return", prefix)
        const until = request.context.until
        // The pi session and its abort finalizer live for the duration of the step.
        const runtime = yield* Effect.runtime<any>()
        const step = Effect.acquireRelease(
          Effect.tryPromise({
            try: async () => {
              const ops: ToolDefinition[] = request.context.access.flatMap(({ binding, write }) =>
                (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op): ToolDefinition => {
                  const name = toolName(op.name, prefix)
                  return {
                    name,
                    label: name,
                    description: op.description,
                    parameters: schemaJson(op.input) as any,
                    execute: async (_id, input) => ({
                      content: [{ type: "text", text: JSON.stringify(await Runtime.runPromise(runtime)(op.execute(input))) }],
                      details: undefined
                    })
                  }
                }))
              let object: unknown
              const outputTool: ToolDefinition | undefined = until?._tag === "Schema" ? {
                name: outputName,
                label: "Return structured output",
                description: "Return the final answer using this tool exactly once.",
                parameters: schemaJson(until.schema) as any,
                execute: async (_id, input) => {
                  object = input
                  return { content: [{ type: "text", text: "Output accepted." }], details: input, terminate: true }
                }
              } : undefined
              const { session } = await createSession({
                ...sessionOptions,
                customTools: [...(sessionOptions.customTools ?? []), ...ops, ...(outputTool ? [outputTool] : [])]
              })
              return { session, object, outputTool }
            },
            catch: (cause) => new AgentFailure({ agent: driver.id, cause })
          }),
          ({ session }) => Effect.promise(() => session.abort()).pipe(Effect.ignore)
        ).pipe(Effect.flatMap(({ session, object, outputTool }) => {
          const execute = Effect.tryPromise({
            try: () => session.prompt([
              request.context.renderSystem(),
              request.context.render() + (outputTool ? `\nFinish by calling ${outputName}.` : "")
            ].filter(Boolean).join("\n\n")),
            catch: (cause) => new AgentFailure({ agent: driver.id, cause })
          }).pipe(Effect.flatMap(() => Effect.gen(function*() {
            if (until?._tag === "Schema") return yield* object === undefined
              ? new AgentFailure({ agent: driver.id, cause: "Structured output tool was not called" })
              : decodeJson(until.schema, JSON.stringify(object))
            const assistant = session.messages.findLast((message: any) => message.role === "assistant") as any
            if (until?._tag === "Thinking") {
              return (assistant?.content?.find((part: any) => part.type === "thinking")?.thinking ?? "") as string
            }
            if (until?._tag === "ToolCall") {
              const call = assistant?.content?.find((part: any) => part.type === "toolCall")
              if (!call) return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
              return { _tag: "ToolCall", id: call.id, name: call.name, input: call.arguments } as unknown
            }
            return textOf(assistant) as string
          })))
          return execute.pipe(Effect.map((value) => ({ _tag: "Result", value }) as StepEvent))
        }))
        // The pi session is created and aborted within the step; the session is one step.
        return { step: step.pipe(Effect.scoped) }
      }) as Effect.Effect<DriverSession, AgentError, never>
    }
    return driver
  }
}
