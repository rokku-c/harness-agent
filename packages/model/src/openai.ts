/** OpenAI-compatible chat completions provider. */
import { Effect, Layer } from "effect"
import { ModelTag, type ModelService } from "./service.ts"
import type { ModelCapabilities, WireMessage, WireTool, WireToolCall } from "./types.ts"

export interface OpenAiConfig {
  readonly api: "openai.chat"
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly maxOutputTokens?: number
}

const capabilities: ModelCapabilities = { streaming: false, thinking: false, multimodal: true, usage: false }

export const openaiModel = (config: OpenAiConfig): ModelService => ({
  id: "openai:" + config.model,
  capabilities,
  generate: (systemPrompt, messages, tools) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          (config.baseURL ?? "https://api.openai.com/v1") + "/chat/completions",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              ...(config.apiKey ? { authorization: "Bearer " + config.apiKey } : {})
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: config.maxOutputTokens ?? 1024,
              messages: [
                { role: "system", content: systemPrompt },
                ...messages.map((message): Record<string, unknown> => {
                  if (message.role === "tool")
                    return { role: "tool", tool_call_id: message.id, content: message.content }
                  if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0)
                    return {
                      role: "assistant",
                      content: message.content.length > 0 ? message.content : null,
                      tool_calls: message.toolCalls.map((call) => ({
                        id: call.id,
                        type: "function",
                        function: { name: call.name, arguments: JSON.stringify(call.input) }
                      }))
                    }
                  return { role: message.role, content: message.content }
                })
              ],
              ...(tools.length > 0
                ? {
                    tools: tools.map((tool) => ({
                      type: "function",
                      function: { name: tool.name, description: tool.description, parameters: tool.input }
                    }))
                  }
                : {})
            })
          }
        )
        if (!response.ok) throw new Error("openai: " + response.status + " " + (await response.text()))
        const data = (await response.json()) as {
          choices: Array<{ message: { content: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>
        }
        const choice = data.choices[0]
        if (choice === undefined) throw new Error("openai: no choices returned")
        return {
          text: choice.message.content ?? "",
          toolCalls: (choice.message.tool_calls ?? []).map((call): WireToolCall => ({
            id: call.id,
            name: call.function.name,
            input: JSON.parse(call.function.arguments || "{}") as unknown
          }))
        }
      },
      catch: (cause) => cause
    })
})

/** M1: the provider as a scoped Layer - swap via provide(ModelTag), not code. */
export const OpenAiLayer = (config: OpenAiConfig): Layer.Layer<ModelTag> => Layer.succeed(ModelTag, openaiModel(config))

export type { WireMessage, WireTool }
