import { Schema } from "effect"

/**
 * 归一化 Message —— 平台无关，与 Anthropic / OpenAI 消息同义，可互相转换，支持多媒体。
 *
 * 核心：content block 形态覆盖 Anthropic（text/image/document/tool_use/tool_result）
 * 与 OpenAI（text/image_url/tool_call/tool_result）的共同结构。
 *
 * 转换：
 *   toAnthropic(message)  → Anthropic MessageParam
 *   toOpenAI(message)     → OpenAI chat/responses input
 */

export type MessageRole = "user" | "assistant" | "system"

/** 图片来源：URL 或 base64（多媒体）。 */
export type ImageSource =
  | { readonly type: "url"; readonly url: string }
  | { readonly type: "base64"; readonly data: string; readonly mediaType: string }

/** 归一化 content block。 */
export type MessageContent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly source: ImageSource }
  | { readonly type: "tool_call"; readonly id: string; readonly name: string; readonly input: unknown }
  | { readonly type: "tool_result"; readonly id: string; readonly output: unknown; readonly isError?: boolean }

/** 归一化消息。 */
export interface Message {
  readonly role: MessageRole
  /** content 可以是纯文本（简化为 string）或 block 数组（多媒体/工具）。 */
  readonly content: string | ReadonlyArray<MessageContent>
  /** 关联 id（对话/投递追踪）。 */
  readonly id?: string
}

/* ── Schema（序列化） ── */

export const ImageSourceSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal("url"), url: Schema.String }),
  Schema.Struct({ type: Schema.Literal("base64"), data: Schema.String, mediaType: Schema.String }),
)

export const MessageContentSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal("text"), text: Schema.String }),
  Schema.Struct({ type: Schema.Literal("image"), source: ImageSourceSchema }),
  Schema.Struct({ type: Schema.Literal("tool_call"), id: Schema.String, name: Schema.String, input: Schema.Unknown }),
  Schema.Struct({ type: Schema.Literal("tool_result"), id: Schema.String, output: Schema.Unknown, isError: Schema.optional(Schema.Boolean) }),
)

export const MessageSchema = Schema.Struct({
  role: Schema.Literal("user", "assistant", "system"),
  content: Schema.Union(Schema.String, Schema.Array(MessageContentSchema)),
  id: Schema.optional(Schema.String),
})

/* ── 构造辅助 ── */

export const text = (role: MessageRole, text: string): Message => ({ role, content: text })
export const userText = (text: string): Message => ({ role: "user", content: text })
export const assistantText = (text: string): Message => ({ role: "assistant", content: text })

export const image = (role: MessageRole, source: ImageSource): Message => ({
  role,
  content: [{ type: "image", source }],
})

export const toolCall = (id: string, name: string, input: unknown): Message => ({
  role: "assistant",
  content: [{ type: "tool_call", id, name, input }],
})

export const toolResult = (id: string, output: unknown, isError = false): Message => ({
  role: "user",
  content: [{ type: "tool_result", id, output, ...(isError ? { isError } : {}) }],
})

/* ── 提取 / 识别 / 注入 ── */

/** 提取一条消息的文本（string content 直接返回；block content 拼接 text block）。 */
export const textOf = (message: Message): string => {
  if (typeof message.content === "string") return message.content
  return message.content
    .filter((block): block is Extract<MessageContent, { type: "text" }> => block.type === "text")
    .map((block) => block.text)
    .join("\n")
}

/** 判断 unknown 是否为归一化 Message（role + content 同时存在）。 */
export const isMessage = (value: unknown): value is Message =>
  typeof value === "object" && value !== null && "role" in value && "content" in value

/** 把 binding 注入值 / 业务输入归一化为 user 消息：Message 原样，string 直接文本，其余 JSON 序列化。 */
export const toMessage = (value: unknown): Message =>
  isMessage(value)
    ? value
    : typeof value === "string"
      ? { role: "user", content: value }
      : { role: "user", content: JSON.stringify(value, null, 2) }

/* ── 转换：Anthropic ── */

/** 转换到 Anthropic MessageParam（content blocks）。 */
export const toAnthropic = (message: Message): Record<string, unknown> => {
  const blocks = typeof message.content === "string"
    ? [{ type: "text" as const, text: message.content }]
    : message.content.map((block) => {
        switch (block.type) {
          case "text": return { type: "text", text: block.text }
          case "image": return block.source.type === "url"
            ? { type: "image", source: { type: "url", url: block.source.url } }
            : { type: "image", source: { type: "base64", media_type: block.source.mediaType, data: block.source.data } }
          case "tool_call": return { type: "tool_use", id: block.id, name: block.name, input: block.input }
          case "tool_result": return { type: "tool_result", tool_use_id: block.id, content: JSON.stringify(block.output) }
        }
      })
  return { role: message.role, content: blocks }
}

/* ── 转换：OpenAI ── */

/** 转换到 OpenAI chat/responses input。 */
export const toOpenAI = (message: Message): Record<string, unknown> => {
  if (typeof message.content === "string") {
    return { role: message.role, content: message.content }
  }
  const parts = message.content.map((block) => {
    switch (block.type) {
      case "text": return { type: "text", text: block.text }
      case "image": return block.source.type === "url"
        ? { type: "image_url", image_url: { url: block.source.url } }
        : { type: "image_url", image_url: { url: `data:${block.source.mediaType};base64,${block.source.data}` } }
      case "tool_call": return { type: "tool_call", id: block.id, name: block.name, input: block.input }
      case "tool_result": return { type: "tool_result", id: block.id, output: JSON.stringify(block.output), is_error: block.isError ?? false }
    }
  })
  return { role: message.role, content: parts }
}
