/**
 * The built-in Anthropic provider connection (zero dependencies, plain fetch
 * under Effect.tryPromise). The model IS a connection.
 */
import { Effect } from "effect"
import type { Connection, Tool } from "./connection.ts"
import type { GenerateResult, Message } from "./message.ts"

export interface AnthropicConfig {
  readonly apiKey: string
  readonly model: string
  readonly baseUrl?: string
  readonly maxTokens?: number
}

const toWire = (messages: ReadonlyArray<Message>) =>
  messages.map((message): Record<string, unknown> => {
    if (message.role === "tool")
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: message.id, content: message.content }]
      }
    if (message.role === "assistant")
      return { role: "assistant", content: [{ type: "text", text: message.content }] }
    return { role: "user", content: [{ type: "text", text: message.content }] }
  })

const toTools = (tools: ReadonlyArray<Tool>) =>
  tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.input
  }))

const anthropicGenerate = (config: AnthropicConfig) =>
  (systemPrompt: string, messages: ReadonlyArray<Message>, tools: ReadonlyArray<Tool>): Effect.Effect<GenerateResult, unknown> =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${config.baseUrl ?? "https://api.anthropic.com"}/v1/messages`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": config.apiKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: config.maxTokens ?? 1024,
            system: systemPrompt,
            messages: toWire(messages),
            tools: toTools(tools)
          })
        })
        if (!response.ok)
          throw new Error(`anthropic: ${response.status} ${await response.text()}`)
        const data = await response.json() as {
          content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>
        }
        const text = data.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("")
        const toolCalls = data.content
          .filter((block) => block.type === "tool_use")
          .map((block) => ({ id: block.id ?? "", name: block.name ?? "", input: block.input }))
        return { text, toolCalls }
      },
      catch: (cause) => cause
    })

/** The built-in Anthropic provider connection (name: "anthropic"). */
export const anthropicProvider = (config: AnthropicConfig): Connection => ({
  name: "anthropic",
  tools: [],
  generate: anthropicGenerate(config)
})
