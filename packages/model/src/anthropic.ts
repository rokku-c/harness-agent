/** Anthropic Messages provider. */
import { Effect, Layer } from "effect"
import { ModelTag, type ModelService } from "./service.ts"
import type { ModelCapabilities, WireToolCall } from "./types.ts"

export interface AnthropicConfig {
  readonly api: "anthropic.messages"
  readonly model: string
  readonly apiKey?: string
  readonly authToken?: string
  readonly baseURL?: string
  readonly maxOutputTokens?: number
}

const capabilities: ModelCapabilities = { streaming: false, thinking: true, multimodal: true, usage: false }

export const anthropicModel = (config: AnthropicConfig): ModelService => ({
  id: "anthropic:" + config.model,
  capabilities,
  generate: (systemPrompt, messages, tools) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch(
          (config.baseURL ?? "https://api.anthropic.com") + "/v1/messages",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "anthropic-version": "2023-06-01",
              ...(config.apiKey ? { "x-api-key": config.apiKey } : {}),
              ...(config.authToken ? { authorization: "Bearer " + config.authToken } : {})
            },
            body: JSON.stringify({
              model: config.model,
              max_tokens: config.maxOutputTokens ?? 1024,
              system: systemPrompt,
              messages: messages.map((message): Record<string, unknown> => {
                if (message.role === "tool")
                  return {
                    role: "user",
                    content: [{ type: "tool_result", tool_use_id: message.id, content: message.content }]
                  }
                if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
                  const blocks: Array<Record<string, unknown>> = []
                  if (message.content.length > 0) blocks.push({ type: "text", text: message.content })
                  for (const call of message.toolCalls)
                    blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input })
                  if (blocks.length === 0) blocks.push({ type: "text", text: "" })
                  return { role: "assistant", content: blocks }
                }
                return { role: message.role, content: [{ type: "text", text: message.content }] }
              }),
              ...(tools.length > 0
                ? { tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.input })) }
                : {})
            })
          }
        )
        if (!response.ok) throw new Error("anthropic: " + response.status + " " + (await response.text()))
        const data = (await response.json()) as {
          content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>
        }
        const text = data.content.filter((block) => block.type === "text").map((block) => block.text ?? "").join("")
        const toolCalls = data.content
          .filter((block) => block.type === "tool_use")
          .map((block): WireToolCall => ({ id: block.id ?? "", name: block.name ?? "", input: block.input }))
        return { text, toolCalls }
      },
      catch: (cause) => cause
    })
})

/** M1: the provider as a scoped Layer. */
export const AnthropicLayer = (config: AnthropicConfig): Layer.Layer<ModelTag> => Layer.succeed(ModelTag, anthropicModel(config))
