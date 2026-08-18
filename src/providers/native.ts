import { Effect } from "effect"
import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import { AgentFailure, decode, type AgentError, type Driver, materialize, requireSubagents, requireUntil, schemaJson, toolName, type DriverContext, type DriverSession, type StepEvent } from "../core.js"
import { MaxOutputTokens, ToolNaming, type MaxOutputTokensConfig } from "../defaults.js"

export interface NativeOptions {
  /** Official SDK client: `Anthropic` or `OpenAI`. */
  readonly client: Anthropic | OpenAI
  /** Provider API: "anthropic.messages" | "openai.responses" | "openai.chat". */
  readonly api: string
  readonly model: string
  /** Max-output-tokens escalation policy. Default {@link MaxOutputTokens}. */
  readonly maxOutputTokens?: MaxOutputTokensConfig
  /** Optional cap on tool-loop iterations. undefined = unbounded (runs until the API errors or a result is produced). */
  readonly maxToolSteps?: number
  /** Optional cap on schema-correction rounds. undefined = unbounded (keeps feeding validation errors back until success or API error). */
  readonly maxSchemaRetries?: number
  /** Prefix applied to injected tool names. Default no prefix. `false` means no prefix. */
  readonly toolPrefix?: string | false
}

/** A single model call result: captured structured output (if any) plus final text. */
interface ModelCallResult {
  readonly output: unknown
  readonly text: string
}

/**
 * A provider driver that talks directly to the official Anthropic / OpenAI SDKs,
 * bypassing the @ai-sdk/* compatibility layer (which mis-validates some gateways'
 * thinking blocks). Structured output uses the tool-call pattern: inject an output
 * tool, force the model to call it, validate the arguments, and feed validation
 * errors back as a corrective loop — mirroring Claude Code's `StructuredOutput`.
 *
 * Everything is expressed as Effect: the SDK calls are wrapped in `Effect.tryPromise`
 * (the SDK callback boundary), the tool loop is a recursive Effect, and validation
 * uses `Schema.decodeUnknown` through `Either`.
 */
export const NativeAgent = {
  make: (options: NativeOptions): Driver => {
    const driver: Driver = {
      id: "native",
      capabilities: {
        provider: { _tag: "Fixed", api: options.api },
        granularity: "event", thinking: false,
        cancel: true, pause: false, resume: false, fork: "node",
        tools: "native", toolCalls: "observe", structuredOutput: "native", sandbox: "delegated", subagents: false
      },
      start: (request: DriverContext): Effect.Effect<DriverSession, AgentError, never> => Effect.gen(function*() {
        yield* requireUntil(driver.id, driver.capabilities, request.context.until)
        yield* requireSubagents(driver.id, driver.capabilities, request.context.subagents)
        request = yield* materialize(request)
        const until = request.context.until
        const isAnthropic = options.api === "anthropic.messages"

        // 工具定义：保留一个内部 _execute（Effect），SDK 回调边界里再跑成 Promise。
        const makeTool = (name: string, description: string, schema: Record<string, unknown>, execute: (input: unknown) => Effect.Effect<any, AgentError, any>) => ({
          name,
          description,
          ...(isAnthropic ? { input_schema: schema } : { parameters: schema }),
          _execute: execute
        } as { name: string; description: string; [key: string]: unknown; _execute: (input: unknown) => Effect.Effect<any, AgentError, any> })
        const baseTools = request.context.access.flatMap(({ binding, write }) =>
          (binding.ops ?? []).filter((op) => op.access === "read" || write).map((op) =>
            makeTool(toolName(op.name, options.toolPrefix ?? ""), op.description, schemaJson(op.input) as unknown as Record<string, unknown>, (input) =>
              op.execute(input).pipe(
                Effect.mapError((cause) => new AgentFailure({ agent: driver.id, cause }))
              )
            )
          )
        )
        const outputSchema = until?._tag === "Schema" ? schemaJson(until.schema) as unknown as Record<string, unknown> : undefined
        const outputTool = outputSchema
          ? makeTool(ToolNaming.outputToolName, "Return the final structured answer by calling this tool exactly once.", outputSchema, () => Effect.succeed("ok"))
          : undefined
        const tools = [...baseTools, ...(outputTool ? [outputTool] : [])]

        /** 一次底层 SDK 调用（Anthropic messages.create 或 OpenAI responses.create）。 */
        const sdkCreate = (messages: ReadonlyArray<unknown>, toolNames: ReadonlyArray<string>, maxTokens: number): Effect.Effect<any, AgentError, never> => {
          const error = (cause: unknown) => new AgentFailure({ agent: driver.id, cause })
          if (isAnthropic) {
            const client = options.client as Anthropic
            const anthropicTools = tools.filter((t) => toolNames.includes(t.name)).map(({ _execute: _e, ...t }) => t as any)
            return Effect.tryPromise({
              try: () => client.messages.create({
                model: options.model,
                max_tokens: maxTokens,
                ...(request.context.alwaysText ? { system: request.context.alwaysText } : {}),
                messages: messages as any,
                ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {})
                // 不用 tool_choice：Anthropic thinking 模式不支持强制 tool_choice。
              } as any),
              catch: error
            })
          }
          const client = options.client as OpenAI
          const openaiTools = tools.filter((t) => toolNames.includes(t.name)).map(({ _execute: _e, ...t }) => ({ ...t, type: "function" }) as any)
          return Effect.tryPromise({
            try: () => client.responses.create({
              model: options.model,
              max_output_tokens: maxTokens,
              input: messages as any,
              ...(request.context.alwaysText ? { instructions: request.context.alwaysText } : {}),
              ...(openaiTools.length > 0 ? { tools: openaiTools } : {})
              // 不用 tool_choice：deepseek 的 openai.responses 网关不接受强制 tool_choice。
            } as any),
            catch: error
          })
        }

        /** 从 SDK 响应里提取工具调用（Anthropic tool_use / OpenAI function_call）。 */
        const toolCallsOf = (res: any): ReadonlyArray<{ id: string; name: string; input: unknown }> =>
          isAnthropic
            ? res.content.filter((b: any) => b.type === "tool_use").map((b: any) => ({ id: b.id, name: b.name, input: b.input }))
            : res.output.filter((item: any) => item.type === "function_call").map((c: any) => {
                let input: unknown
                try { input = JSON.parse(c.arguments) } catch { input = c.arguments }
                return { id: c.call_id, name: c.name, input }
              })

        /** 提取 assistant 文本（用于非 Schema 分支）。 */
        const textOf = (res: any): string =>
          isAnthropic
            ? res.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n")
            : res.output_text ?? ""

        /** 判断响应是否因输出 token 耗尽而截断（Anthropic stop_reason / OpenAI 无输出结束）。 */
        const truncated = (res: any): boolean =>
          isAnthropic
            ? res.stop_reason === "max_tokens"
            : res.output?.length === 0 && (res.status === "incomplete" || res.status === "failed")

        /** 工具执行 + 结果回填（Anthropic tool_result / OpenAI function_call_output）。 */
        const executeTools = (calls: ReadonlyArray<{ id: string; name: string; input: unknown }>): Effect.Effect<ReadonlyArray<unknown>, AgentError, any> =>
          Effect.forEach(calls, (call) => {
            const tool = baseTools.find((t) => t.name === call.name)
            if (!tool) return Effect.succeed({ type: isAnthropic ? "tool_result" : "function_call_output", ...(isAnthropic ? { tool_use_id: call.id } : { call_id: call.id }), content: "unknown tool" })
            return tool._execute(call.input).pipe(
              Effect.map((value) => ({
                type: isAnthropic ? "tool_result" : "function_call_output",
                ...(isAnthropic ? { tool_use_id: call.id } : { call_id: call.id }),
                content: typeof value === "string" ? value : JSON.stringify(value)
              }))
            )
          }, { concurrency: "unbounded" })

        /** 把 assistant 消息 + 工具结果拼成下一轮 messages。 */
        const nextMessages = (messages: ReadonlyArray<unknown>, res: any, results: ReadonlyArray<unknown>): ReadonlyArray<unknown> =>
          isAnthropic
            ? [...messages, { role: "assistant", content: res.content }, { role: "user", content: results }]
            : [...res.output, ...results]

        /** 递归 Effect：无硬上限地跑工具循环，直到产出结果或 API 报错。 */
        const toolLoop = (
          messages: ReadonlyArray<unknown>,
          steps: number,
          maxTokens: number
        ): Effect.Effect<ModelCallResult, AgentError, any> => {
          // 可选防呆阀：maxToolSteps 未设置（默认）时无限；设置了才在超限时放弃。
          if (options.maxToolSteps !== undefined && steps >= options.maxToolSteps)
            return Effect.fail(new AgentFailure({ agent: driver.id, cause: "Tool loop exceeded maxToolSteps" }))
          return sdkCreate(messages, tools.map((t) => t.name), maxTokens).pipe(
            Effect.flatMap((res) => {
              // 输出被 max_tokens 截断：按倍率升级重试（同一轮消息，更大预算）。
              if (truncated(res)) {
                const policy = options.maxOutputTokens ?? MaxOutputTokens
                const nextTokens = Math.min(maxTokens * policy.multiplier, policy.cap)
                if (nextTokens > maxTokens && steps < policy.maxAttempts)
                  return toolLoop(messages, steps, nextTokens)
                // 已到上限或次数用完：把已产出的文本作为结果（或明确失败）。
                return Effect.succeed({ output: undefined, text: textOf(res) })
              }
              const calls = toolCallsOf(res)
              const outputCall = calls.find((c) => c.name === ToolNaming.outputToolName)
              if (outputCall) return Effect.succeed({ output: outputCall.input, text: textOf(res) })
              if (calls.length === 0) return Effect.succeed({ output: undefined, text: textOf(res) })
              return executeTools(calls).pipe(
                Effect.flatMap((results) => toolLoop(nextMessages(messages, res, results), steps + 1, maxTokens))
              )
            })
          )
        }

        // ── 主循环：tool 模式 → 校验 output 工具入参，失败则追加反馈消息让模型自纠。
        // 无硬上限：schema 校验失败就像工具调用失败一样，把详细错误返回给 Agent，让它
        // 持续迭代修正，直到成功或 API 报错。可选 maxSchemaRetries 防呆阀（默认关闭）。
        const makeStep = Effect.gen(function*() {
          // 首次 user 消息：任务内容 + output 工具的强制指令。
          const initialMessage = { role: "user", content: request.context.render() + (outputTool
            ? `\n\nYou MUST call ${ToolNaming.outputToolName} exactly once to return your final structured answer. Do NOT put the answer in text.`
            : "") }
          const policy = options.maxOutputTokens ?? MaxOutputTokens
          // 尾递归 Effect：状态（messages/corrections）作为参数传递，直到成功或 API 报错。
          const go = (
            messages: ReadonlyArray<unknown>,
            corrections: number
          ): Effect.Effect<StepEvent, AgentError, any> =>
            toolLoop(messages, 0, policy.default).pipe(
              Effect.flatMap((result) => {
                // 非 Schema：返回文本
                if (until?._tag !== "Schema") {
                  return Effect.succeed({ _tag: "Result", value: result.text } as StepEvent)
                }
                // Schema：校验 output 工具入参
                if (result.output !== undefined) {
                  return Effect.either(decode(until.schema, result.output)).pipe(
                    Effect.flatMap((parsed) => {
                      if (parsed._tag === "Right") return Effect.succeed({ _tag: "Result", value: parsed.right } as StepEvent)
                      // 可选防呆阀：maxSchemaRetries 未设置（默认）时无限修正；设置了才在超限时放弃。
                      if (options.maxSchemaRetries !== undefined && corrections >= options.maxSchemaRetries)
                        return Effect.fail(new AgentFailure({ agent: driver.id, cause: "Structured output failed schema validation" }))
                      const errorText = String(parsed.left)
                      return go([...messages, { role: "user", content: `Your call to ${ToolNaming.outputToolName} did not match the schema: ${errorText}. Call it again with corrected arguments.` }], corrections + 1)
                    })
                  )
                }
                // 模型没调用 output 工具：反馈回去让它调用（不设上限，直到 API 报错）。
                return go([...messages, { role: "user", content: `You must call ${ToolNaming.outputToolName} to return the answer. Call it now.` }], corrections)
              })
            )
          return yield* go([initialMessage], 0)
        })
        return { step: makeStep }
      }) as unknown as Effect.Effect<DriverSession, AgentError, never>
    }
    return driver
  }
}
