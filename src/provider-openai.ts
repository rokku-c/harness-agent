/**
 * The built-in OpenAI-compatible provider connection (zero dependencies,
 * plain fetch under Effect.tryPromise): works with OpenAI, DeepSeek, and any
 * chat-completions-compatible endpoint. The model IS a connection.
 */
import { Effect } from "effect"
import type { Connection, Tool } from "./connection.ts"
import type { GenerateResult, Message } from "./message.ts"

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

const openaiGenerate = (config: OpenAiConfig) =>
  (systemPrompt: string, messages: ReadonlyArray<Message>, tools: ReadonlyArray<Tool>): Effect.Effect<GenerateResult, unknown> =>
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

/** The built-in OpenAI-compatible provider connection (name: "openai"). */
export const openaiProvider = (config: OpenAiConfig): Connection => ({
  name: "openai",
  tools: [],
  generate: openaiGenerate(config)
})
