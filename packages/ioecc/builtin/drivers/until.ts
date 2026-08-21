import { Effect, Schema, Stream } from "effect"
import { type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { ClaudeCodeError, claudeStream } from "./claude-code.js"

/**
 * Until + fork —— 跑 Claude Code 直到某点，在那 fork。
 *
 * until 是观察投影：跑到「第一个 thinking」或「输出符合 schema」等边界，
 * 就在那个点 fork 出子 agent/session（把当前状态/消息交给子任务）。
 *
 * 用 Stream：SDK 消息流 → claudeStream，Stream.takeUntil 天然表达「到某点停」。
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

/* ── runUntil：Stream 跑到 until 边界，在那 fork ── */

export interface RunUntilOptions {
  readonly options: Options
  /** 在 until 边界触发 fork：收到已收集的消息 + 命中的边界消息，返回子任务结果。 */
  readonly fork: (messages: ReadonlyArray<SDKMessage>, matched: SDKMessage) => Effect.Effect<unknown, ClaudeCodeError>
}

/**
 * 跑 Claude Code，Stream 逐条观察，until 边界 fork（派生子任务）。
 * 返回 [最终结果, fork 点信息]。
 */
export const runUntil = (
  prompt: string,
  until: Until<any>,
  opts: RunUntilOptions
): Effect.Effect<{ output: unknown; forked: boolean; matched: SDKMessage | undefined }, ClaudeCodeError> =>
  Effect.gen(function* () {
    // Stream 收集：保留 until 边界的消息（takeUntil 含命中项）。
    const chunk = yield* claudeStream(prompt, opts.options).pipe(Stream.runCollect)
    const messages = [...chunk]

    // 找第一个满足 until 的消息（fork 点）。
    const matched = messages.find((m) => satisfies(until, m))

    // 在边界 fork：把已收集消息 + 命中消息交给子任务。
    if (matched) {
      yield* opts.fork(messages, matched).pipe(
        Effect.mapError((cause) => new ClaudeCodeError({ stage: "fork", cause })),
        Effect.ignore
      )
    }

    // 最终输出：result 消息的 structured_output 或 result。
    const result = messages.findLast((m) => m.type === "result" && m.subtype === "success")
    return {
      output: result?.structured_output ?? result?.result ?? messages.at(-1),
      forked: matched !== undefined,
      matched,
    }
  })
