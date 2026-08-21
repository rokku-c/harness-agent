import { Effect, Schema } from "effect"
import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { ClaudeCodeError } from "./claude-code.js"

/**
 * Until + fork —— 跑 Claude Code 直到某点，在那 fork。
 *
 * until 是观察投影：跑到「第一个 thinking」或「输出符合 schema」等边界，
 * 就在那个点 fork 出子 agent/session（把当前状态/消息交给子任务）。
 *
 *   const program = runUntil(
 *     { options: { model } }, "分析这个", Until.schema(ReviewSchema),
 *     (messages, matched) => Effect.succeed(forkChild(messages))   // 到边界时 fork
 *   )
 */

/* ── Until：观察投影 ── */

export type Until<A = unknown> =
  /** 到第一个 thinking。 */
  | { readonly kind: "thinking" }
  /** 输出符合 schema。 */
  | { readonly kind: "schema"; readonly schema: Schema.Schema<A, any, never> }
  /** 完整跑完。 */
  | { readonly kind: "stop" }
  /** 到出现文本。 */
  | { readonly kind: "text" }

export const Until = {
  thinking: (): Until<unknown> => ({ kind: "thinking" }),
  schema: <A>(schema: Schema.Schema<A, any, never>): Until<A> => ({ kind: "schema", schema }),
  stop: (): Until<string> => ({ kind: "stop" }),
  text: (): Until<string> => ({ kind: "text" }),
}

/* ── 判断一条消息是否满足 until ── */

const satisfies = (until: Until<any>, message: SDKMessage): boolean => {
  switch (until.kind) {
    case "thinking":
      // SDK thinking 是 system 消息的 thinking_tokens subtype。
      return message.type === "system" && message.subtype === "thinking_tokens"
    case "text":
      return message.type === "assistant" && message.message.content.some((b) => b.type === "text")
    case "schema":
      // 输出符合 schema 发生在 result 消息的 structured_output。
      return message.type === "result" && message.subtype === "success" && message.structured_output !== undefined
    case "stop":
      return message.type === "result"
  }
}

/* ── runUntil：迭代消息，until 满足时 fork ── */

export interface RunUntilOptions {
  readonly options: Options
  /** 在 until 边界触发 fork：收到当前已收集的消息 + 命中的边界消息，返回子任务结果。 */
  readonly fork: (messages: ReadonlyArray<SDKMessage>, matched: SDKMessage) => Effect.Effect<unknown, ClaudeCodeError>
}

/**
 * 跑 Claude Code，逐条观察消息，until 条件满足时 fork（派生子任务）。
 * 返回 [最终结果, fork 点信息]。
 */
export const runUntil = (
  prompt: string,
  until: Until<any>,
  opts: RunUntilOptions
): Effect.Effect<{ output: unknown; forked: boolean; matched: SDKMessage | undefined }, ClaudeCodeError> =>
  Effect.tryPromise({
    try: async () => {
      const messages: SDKMessage[] = []
      let matched: SDKMessage | undefined
      let forked = false
      for await (const message of query({ prompt, options: opts.options })) {
        messages.push(message)
        // until 边界：fork 一次（只 fork 第一个满足点）。
        if (!forked && satisfies(until, message)) {
          matched = message
          forked = true
          // 在边界 fork：把已收集的消息 + 命中的消息交给 fork。
          // 注意：fork 是 Effect，这里在 async 里 await Effect.runPromise。
          await Effect.runPromise(
            opts.fork(messages, message).pipe(
              Effect.mapError((cause) => new ClaudeCodeError({ stage: "fork", cause })),
              Effect.ignore
            )
          )
        }
      }
      // 最终输出：result 消息的 structured_output 或 result。
      const result = messages.findLast((m) => m.type === "result" && m.subtype === "success")
      return {
        output: result?.structured_output ?? result?.result ?? messages.at(-1),
        forked,
        matched,
      }
    },
    catch: (cause) => new ClaudeCodeError({ stage: "sdk", cause }),
  })
