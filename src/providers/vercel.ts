import { Effect, Runtime } from "effect"
import { Output, generateText, jsonSchema, tool, type LanguageModel, type ToolSet } from "ai"
import { AgentFailure, decode, type AgentError, type Driver, materialize, requireSubagents, requireUntil, schemaJson, toolName, type DriverContext, type DriverSession, type StepEvent } from "../core.js"
import { MaxOutputTokens, ProviderDefaults, ToolNaming, type MaxOutputTokensConfig } from "../defaults.js"

export interface VercelOptions {
  readonly model: LanguageModel
  readonly api?: string
  readonly instructions?: string
  readonly maxSteps?: number
  /** Prefix applied to injected tool names. Default no prefix. `false` means no prefix. */
  readonly toolPrefix?: string | false
  /** Max-output-tokens escalation policy. Default {@link MaxOutputTokens}. */
  readonly maxOutputTokens?: MaxOutputTokensConfig
  /**
   * Disable extended thinking on Anthropic-compatible providers. Some gateways (e.g. deepseek
   * via anthropic.messages) return thinking blocks whose shape @ai-sdk/anthropic rejects
   * ("expected string, received undefined" at content[0].thinking), breaking structured output.
   * Default true when api starts with "anthropic".
   */
  readonly disableThinking?: boolean
  /** Optional cap on schema-correction rounds. undefined = unbounded (feeds errors back until success or API error). */
  readonly maxSchemaRetries?: number
  /**
   * Force the output tool via `toolChoice` in tool mode. Default false — Anthropic thinking mode
   * rejects `tool_choice` ("Thinking mode does not support this tool_choice"). Providers that
   * accept toolChoice can set this to make the constraint structural rather than prompt-driven.
   */
  readonly forceToolChoice?: boolean
  /**
   * How structured output (`Until.schema`) is produced:
   *   - "tool" (default): inject an `effect_agent_return` output tool, force the model to call it
   *     via `toolChoice`, and capture the tool-call arguments as the structured output. On schema
   *     validation failure the error is fed back as a message and the model corrects itself.
   *   - "json": use Vercel's `Output.object` (responseFormat json + text parsing). More fragile —
   *     depends on the provider honoring responseFormat and emitting parseable JSON.
   */
  readonly structuredOutput?: "tool" | "json"
}

const makeTools = (request: DriverContext, runtime: Runtime.Runtime<any>, prefix: string | false): ToolSet =>
  Object.fromEntries(request.context.access.flatMap(({ binding, write }) =>
    (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op) => [toolName(op.name, prefix), tool({
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
        tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated", subagents: false
      },
      start: (request: DriverContext): Effect.Effect<DriverSession, AgentError, never> => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.context.until)
        yield* requireSubagents(driver.id, driver.capabilities, request.context.subagents)
        request = yield* materialize(request)
        const runtime = yield* Effect.runtime<any>()
        const until = request.context.until
        const mode = (options.structuredOutput ?? ProviderDefaults.structuredOutput) === "tool" ? "tool" : "json"

        const baseTools = makeTools(request, runtime, options.toolPrefix ?? "")
        const outputTool = until?._tag === "Schema" && mode === "tool" ? tool({
          description: "Return the final structured answer by calling this tool exactly once with the result.",
          inputSchema: jsonSchema(schemaJson(until.schema) as any),
          execute: async () => "output accepted"
        }) : undefined
        const tools: ToolSet = {
          ...baseTools,
          ...(outputTool ? { [ToolNaming.outputToolName]: outputTool } : {})
        }

        const runOnce = (messages: ReadonlyArray<any>): Promise<any> => {
          const thinkingDisabled = options.disableThinking ?? ProviderDefaults.disableThinking
          const policy = options.maxOutputTokens ?? MaxOutputTokens
          return generateText({
            model: options.model,
            instructions: options.instructions,
            system: request.context.alwaysText,
            ...(messages.length > 0 ? { messages } : { prompt: request.context.render() + (outputTool
              ? `\n\nYou MUST call ${ToolNaming.outputToolName} exactly once to return your final structured answer. Do NOT put the answer in text.`
              : "") }),
            tools,
            // 强制 toolChoice：默认关闭——Anthropic thinking 模式不支持 tool_choice，
            // 会报 "Thinking mode does not support this tool_choice"。靠 prompt 强制 + 校验
            // 纠正循环复刻 Claude Code 的方式。支持 tool_choice 的 provider 可显式开启。
            ...(outputTool && options.forceToolChoice ? { toolChoice: { type: "tool", toolName: ToolNaming.outputToolName } as any } : {}),
            // 关闭 Anthropic thinking：deepseek 网关的 thinking 块格式不被 @ai-sdk/anthropic
            // 接受，会破坏结构化输出。默认对 anthropic provider 关闭。
            ...(thinkingDisabled ? { thinking: { type: "disabled" } } : {}),
            maxOutputTokens: policy.default,
            // 注意：不传 stopWhen。传 stopWhen 会让 generateText 进入多步工具循环模式，
            // 每步发一次请求，Anthropic provider 对 deepseek 网关的 thinking 块校验会失败
            // （"expected string, received undefined" at content[0].thinking）。不传时单次调用，
            // 工具自动循环到自然结束，规避该 bug。
            ...(until?._tag === "Schema" && mode === "json" ? {
              output: Output.object({ schema: jsonSchema(schemaJson(until.schema) as any) })
            } : {})
          } as any)
        }

        // 主循环：tool 模式 → 校验 output 工具入参，失败则追加反馈消息让模型自纠。
        // 无硬上限：schema 校验失败就像工具调用失败一样，把详细错误返回给 Agent，让它
        // 持续迭代修正，直到成功或 API 报错。可选 maxSchemaRetries 防呆阀（默认关闭）。
        const makeStep = Effect.gen(function*() {
          if (until?._tag !== "Schema" || mode === "json") {
            // 非 Schema 或 json 模式：单次调用。
            let messages: ReadonlyArray<any> = []
            const result = yield* Effect.tryPromise({
              try: () => runOnce(messages),
              catch: (cause) => new AgentFailure({ agent: driver.id, cause })
            })
            const value: unknown = (() => {
              switch (until?._tag) {
                case "Stop": return result.text
                case "Text": return result.text
                case "Thinking": return result.finalStep.reasoningText
                case "ToolCall": {
                  const call = result.toolCalls[0]
                  if (!call) return undefined
                  return { _tag: "ToolCall", id: call.toolCallId, name: call.toolName, input: call.input }
                }
                case "Schema": {
                  try { return result.output } catch { return undefined }
                }
                default: return result.text
              }
            })()
            if (value === undefined && until?._tag === "ToolCall")
              return yield* new AgentFailure({ agent: driver.id, cause: "No tool call produced" })
            if (value === undefined && until?._tag === "Schema")
              return yield* new AgentFailure({ agent: driver.id, cause: "No structured output produced" })
            return { _tag: "Result", value } as StepEvent
          }

          // ── tool 模式：强制调用 output 工具 + schema 校验纠正循环（无上限）──
          // 尾递归 Effect：状态（messages/corrections）作为参数传递，直到成功或 API 报错。
          const go = (messages: ReadonlyArray<any>, corrections: number): Effect.Effect<StepEvent, AgentError, never> =>
            Effect.tryPromise({
              try: () => runOnce(messages),
              catch: (cause) => new AgentFailure({ agent: driver.id, cause })
            }).pipe(
              Effect.flatMap((result) => {
                // 找到 output 工具的调用，取其参数作为候选结构化输出
                const outputCall = (result.toolCalls as ReadonlyArray<any>).find((call: any) => call.toolName === ToolNaming.outputToolName)
                if (!outputCall) {
                  // 模型没调用 output 工具：反馈回去让它调用（不设上限）。
                  return go([...result.response.messages, {
                    role: "user", content: `You must call ${ToolNaming.outputToolName} to return the answer. Call it now.`
                  }], corrections)
                }
                // 校验 output 工具参数是否符合目标 schema
                return Effect.either(decode(until.schema, outputCall.input)).pipe(
                  Effect.flatMap((parsed) => {
                    if (parsed._tag === "Right") {
                      return Effect.succeed({ _tag: "Result", value: parsed.right } as StepEvent)
                    }
                    // 可选防呆阀：maxSchemaRetries 未设置（默认）时无限修正；设置了才在超限时放弃。
                    if (options.maxSchemaRetries !== undefined && corrections >= options.maxSchemaRetries)
                      return Effect.fail(new AgentFailure({ agent: driver.id, cause: "Structured output failed schema validation" }))
                    // 校验失败：把错误反馈给模型，让它修正工具参数（同会话继续）
                    const errorText = String(parsed.left)
                    return go([...result.response.messages, {
                      role: "user", content: `Your call to ${ToolNaming.outputToolName} did not match the schema: ${errorText}\nCall ${ToolNaming.outputToolName} again with corrected arguments.`
                    }], corrections + 1)
                  })
                )
              })
            )
          return yield* go([], 0)
        })
        return {
          step: makeStep
        }
      }).pipe(Effect.scoped) as unknown as Effect.Effect<DriverSession, AgentError, never>
    }
    return driver
  }
}
