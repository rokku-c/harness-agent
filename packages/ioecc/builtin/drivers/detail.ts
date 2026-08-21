import { Effect, Ref, Schema } from "effect"
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk"
import { ClaudeCodeError } from "./claude-code.js"
import type { ConnectionImpl } from "../../src/index.js"

/**
 * ClaudeDetail —— 把 Claude Code 内部运行 detail 暴露为 Connection。
 *
 * Claude Code 的消息流（thinking / text / tool_use / result）是它的内部过程。
 * 这里把它收集到共享 Ref，作为一个普通 Connection（"ClaudeDetail"）暴露，
 * 其他 agent 可声明影响它、读取 detail（观测 = 具体 driver 作为 Connection）。
 */

/* ── 归一化 detail（把 SDK 消息压成可读形态） ── */

export type ClaudeDetail =
  | { readonly _tag: "Thinking"; readonly text: string }
  | { readonly _tag: "Text"; readonly text: string }
  | { readonly _tag: "ToolCall"; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly _tag: "Result"; readonly text: string }
  | { readonly _tag: "Status"; readonly status: string }

/** 从一条 SDK 消息提取 detail（assistant content blocks → thinking/text/tool_use）。 */
export const detailOf = (message: SDKMessage): ReadonlyArray<ClaudeDetail> => {
  switch (message.type) {
    case "assistant": {
      return message.message.content.flatMap((block): ReadonlyArray<ClaudeDetail> => {
        switch (block.type) {
          case "thinking":
            return [{ _tag: "Thinking" as const, text: block.thinking }]
          case "text":
            return [{ _tag: "Text" as const, text: block.text }]
          case "tool_use":
            return [{ _tag: "ToolCall" as const, id: block.id, name: block.name, input: block.input }]
          default:
            return []
        }
      })
    }
    case "result":
      return message.subtype === "success"
        ? [{ _tag: "Result" as const, text: message.result }]
        : []
    case "system":
      return [{ _tag: "Status" as const, status: message.subtype }]
    default:
      return []
  }
}

/* ── ClaudeDetail Connection ── */

export interface ClaudeDetailService {
  /** 已收集的全部 detail。 */
  readonly list: Effect.Effect<ReadonlyArray<ClaudeDetail>, ClaudeCodeError>
  /** 最后一条 detail。 */
  readonly last: Effect.Effect<ClaudeDetail | undefined, ClaudeCodeError>
}

/**
 * 构造 ClaudeDetail Connection：driver 运行时把 detail 写入共享 Ref，
 * 这里提供读取的 impl。
 */
export const makeClaudeDetail = (): {
  readonly ref: Ref.Ref<ReadonlyArray<ClaudeDetail>>
  /** 写入一条 SDK 消息的 detail（driver 运行时调用）。 */
  readonly record: (message: SDKMessage) => Effect.Effect<void>
  /** Connection impl：handle("list"|"last") 读取 detail。 */
  readonly impl: ConnectionImpl
} => {
  const ref = Ref.unsafeMake<ReadonlyArray<ClaudeDetail>>([])

  const record = (message: SDKMessage) =>
    Ref.update(ref, (details) => [...details, ...detailOf(message)])

  const impl: ConnectionImpl = {
    handle: (op, _args) => {
      if (op === "list") return Ref.get(ref).pipe(Effect.map((d) => d as unknown))
      if (op === "last") return Ref.get(ref).pipe(Effect.map((d) => d.at(-1) as unknown))
      return Effect.fail(new ClaudeCodeError({ stage: "sdk", cause: `ClaudeDetail can't ${op}` }))
    },
  }

  return { ref, record, impl }
}
