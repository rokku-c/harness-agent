/**
 * OpenAI-compatible LLM adapter (zero dependencies, plain fetch): works with
 * OpenAI, DeepSeek, and any chat-completions-compatible endpoint.
 */
import { Effect } from "effect"
import type { Llm, LlmResult, Message } from "./agent.ts"
import type { Tool } from "./connection.ts"

export interface OpenAiConfig {
  readonly apiKey: string
  readonly model: string
  /** Defaults to https://api.openai.com/v1 - point it at any compatible host. */
  readonly baseUrl?: string
}

const toWire = (systemPrompt: string, messages: ReadonlyArray<Message>) => [
  { role: "system", content: systemPrompt },
  ...messages.map((message): Record<string, unknown> =>
    message.role === "tool"
      ? { role: "tool", tool_call_id: message.id, content: message.content }
      : { role: message.role, content: message.content })
]

const toTools = (tools: ReadonlyArray<Tool>) =>
  tools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description ?? "", parameters: tool.input }
  }))

export const openaiLlm = (config: OpenAiConfig): Llm => ({
  generate: (systemPrompt, messages, tools) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(`${config.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
          body: JSON.stringify({ model: config.model, messages: toWire(systemPrompt, messages), tools: toTools(tools) })
        })
        if (!response.ok)
          throw new Error(`openai: ${response.status} ${await response.text()}`)
        const data = await response.json() as {
          choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>
        }
        const choice = data.choices[0]
        if (choice === undefined) throw new Error("openai: no choices returned")
        return {
          text: choice.message.content ?? "",
          toolCalls: (choice.message.tool_calls ?? []).map((call) => ({
            id: call.id,
            name: call.function.name,
            input: JSON.parse(call.function.arguments || "{}") as unknown
          }))
        }
      },
      catch: (cause) => cause
    })
})
