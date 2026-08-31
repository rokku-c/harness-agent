/**
 * ClaudeCode: the ComposedAgent adapter. Claude Code is an external agent
 * with its own loop, tools and runtime - effect-agent treats it as a black
 * box and expresses it as just another Driver. Binding ops become native
 * MCP tools inside its runtime; the Until condition decides what comes back.
 */
import { Effect, Runtime, Schema } from "effect"
import {
  createSdkMcpServer,
  query,
  tool as sdkTool,
  type Options,
  type SDKMessage
} from "@anthropic-ai/claude-agent-sdk"
import * as z from "zod"
import {
  AgentFailure,
  decode,
  materialize,
  requireUntil,
  schemaJson,
  type Driver,
  type Op,
  type RunRequest
} from "@effect-agent/core"

export interface ClaudeCodeOptions extends Omit<Options, "outputFormat" | "hooks"> {
  /** Injectable query - tests pass a stub here instead of the SDK. */
  readonly query?: typeof query
  /** Native Claude Code hooks, passed straight through (not HarnessHooks). */
  readonly claudeCodeHooks?: Options["hooks"]
  /** Isolated CLAUDE_CONFIG_DIR; a random temporary directory is used when omitted. */
  readonly claudeHome?: string
}

const safeToolName = (name: string) => name.replace(/[^a-zA-Z0-9_-]/g, "_")

const zodFromJson = (schema: any): z.ZodType => {
  if (schema === undefined || schema === null) return z.any()
  if (schema.enum && Array.isArray(schema.enum)) {
    if (schema.enum.length === 1) return z.literal(schema.enum[0])
    return z.enum(schema.enum)
  }
  switch (schema.type) {
    case "string":
      return z.string()
    case "number":
    case "integer":
      return z.number()
    case "boolean":
      return z.boolean()
    case "array":
      return z.array(zodFromJson(schema.items))
    case "object": {
      const shape: Record<string, z.ZodType> = {}
      const properties = schema.properties ?? {}
      for (const [key, value] of Object.entries(properties)) shape[key] = zodFromJson(value)
      if (Object.keys(shape).length === 0) return z.record(z.string(), z.any())
      const object = z.object(shape)
      return schema.additionalProperties === false ? object.strict() : object
    }
    default:
      return schema.type === "null" ? z.null() : z.any()
  }
}

interface InjectedOp {
  readonly opName: string
  readonly allowedName: string
  readonly definition: ReturnType<typeof sdkTool>
}

const mcpTools = (ops: ReadonlyArray<Op<any, any, any, any>>, runtime: Runtime.Runtime<any>): ReadonlyArray<InjectedOp> =>
  ops.map((op) => {
    const name = safeToolName(op.name)
    const root = zodFromJson(schemaJson(op.input))
    const shape = root instanceof z.ZodObject ? root.shape : { input: root }
    return {
      opName: op.name,
      allowedName: "mcp__effect_agent__" + name,
      definition: sdkTool(name, op.description, shape, async (input) => {
        const decoded = await Runtime.runPromise(runtime)(Schema.decodeUnknown(op.input)(input))
        const output = await Runtime.runPromise(runtime)(op.execute(decoded))
        return { content: [{ type: "text" as const, text: JSON.stringify(output) }] }
      })
    }
  })

export const ClaudeCode = {
  make: (options: ClaudeCodeOptions = {}): Driver => {
    const driver: Driver = {
      id: "claude-code",
      capabilities: {
        provider: { _tag: "Fixed", api: "anthropic.messages" },
        granularity: "run",
        thinking: true,
        cancel: true,
        pause: true,
        resume: false,
        fork: "session",
        tools: "native",
        toolCalls: "intercept",
        structuredOutput: "native",
        sandbox: "delegated"
      },
      run: <A, R>(request: RunRequest<A, R>) =>
        Effect.gen(function* () {
          const unsupported = requireUntil(driver.id, driver.capabilities, request.until)
          if (unsupported) return yield* Effect.fail(unsupported)
          const prepared = yield* materialize(request)
          const runtime = yield* Effect.runtime<any>()

          // read ops always; write ops only where write access was granted
          const ops: Array<Op<any, any, any, any>> = prepared.access.flatMap(({ binding, write }) =>
            (binding.ops ?? []).filter((op) => op.access === "read" || write)
          )
          const injected = mcpTools(ops, runtime)
          const outputFormat = request.until._tag === "Schema"
            ? { type: "json_schema" as const, schema: schemaJson(request.until.schema) as unknown as Record<string, unknown> }
            : undefined

          const sdkOptions: Options = { ...options }
          const effectiveMcpServers = injected.length > 0
            ? {
                ...sdkOptions.mcpServers,
                effect_agent: createSdkMcpServer({ name: "effect_agent", version: "0.0.0", tools: injected.map(({ definition }) => definition) })
              }
            : sdkOptions.mcpServers
          const effectiveAllowedTools = [
            ...((sdkOptions.allowedTools ?? []) as ReadonlyArray<string>),
            ...injected.map(({ allowedName }) => allowedName)
          ]
          const effectiveEnv: Record<string, string | undefined> = {
            ...process.env,
            ...(sdkOptions.env ?? {}),
            ...(options.claudeHome ? { CLAUDE_CONFIG_DIR: options.claudeHome } : {})
          }
          const runQuery = options.query ?? query

          const messages = yield* Effect.tryPromise({
            try: async () => {
              const all: SDKMessage[] = []
              for await (const message of runQuery({
                prompt: prepared.context.render(),
                options: {
                  ...sdkOptions,
                  env: effectiveEnv,
                  hooks: options.claudeCodeHooks,
                  mcpServers: effectiveMcpServers,
                  allowedTools: effectiveAllowedTools,
                  outputFormat
                }
              })) all.push(message)
              return all
            },
            catch: (cause) =>
              new AgentFailure({
                agent: driver.id,
                cause,
                message: cause instanceof Error ? cause.message : String(cause)
              })
          })

          const result = messages.findLast((message) => message.type === "result")
          if (!result || result.subtype !== "success")
            return yield* new AgentFailure({ agent: driver.id, cause: result ?? "No result" })
          if (request.until._tag === "Schema") {
            const structured = (result as { structured_output?: unknown }).structured_output
            return yield* Effect.mapError(decode(request.until.schema, structured), (cause) =>
              new AgentFailure({ agent: driver.id, cause })
            ) as Effect.Effect<A, AgentFailure>
          }
          if (request.until._tag === "Stop" || request.until._tag === "Text") return result.result as A
          const assistant = messages.findLast((message) => message.type === "assistant")
          const blocks = ((assistant?.message?.content ?? []) as unknown) as Array<{ type: string; thinking?: string; id?: string; name?: string; input?: unknown }>
          if (request.until._tag === "Thinking") {
            const thinking = blocks.find((block) => block.type === "thinking")
            return ((thinking && thinking.thinking) || "") as A
          }
          const call = blocks.find((block) => block.type === "tool_use")
          if (!call || !call.id || !call.name)
            return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
          return { _tag: "ToolCall", id: call.id, name: call.name, input: call.input } as A
        }).pipe(Effect.scoped) as any
    }
    return driver
  }
}

