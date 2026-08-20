import { textOf, type Context } from "@effect-agent/core"

/**
 * 渲染助手：把 Context 投影为驱动所需的 prompt 文本。
 *
 * 核心 Context 不包含 prompt 概念；渲染是驱动/适配职责，这里提供共享实现。
 * `messages` 是归一化 Message（与 Anthropic/OpenAI 同义）；渲染时取各消息的文本块。
 */

/** 渲染持久指令（system prompt），无则空。 */
export const renderSystem = (context: Context): string => {
  const text = context.alwaysText
  return text === undefined ? "" : `Always: ${text}`
}

/** 渲染当前接收（user prompt）：各接收消息的文本块。 */
export const render = (context: Context): string =>
  context.messages
    .map((message) => {
      const text = textOf(message)
      return text.length > 0 ? text : "<non-text content>"
    })
    .filter((text) => text !== "<non-text content>")
    .join("\n")
