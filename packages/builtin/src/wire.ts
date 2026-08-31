/**
 * The provider wire layer: zero-dependency model generate over plain fetch
 * under Effect.tryPromise. The model is NOT a concept of the agent - it is
 * just what the default driver happens to call.
 */
import { Effect } from "effect"

export interface WireTool {
  readonly name: string
  readonly description: string
  readonly input: Record<string, unknown>
}

export type WireMessage =
  | { readonly role: "user"; readonly content: string }
  | { readonly role: "assistant"; readonly content: string; readonly toolCalls?: ReadonlyArray<WireToolCall> }
  | { readonly role: "tool"; readonly id: string; readonly name: string; readonly content: string }

export interface WireToolCall {
  readonly id: string
  readonly name: string
  readonly input: unknown
}

export interface GenerateResult {
  readonly text: string
  readonly toolCalls: ReadonlyArray<WireToolCall>
}

/** The model surface the default driver loops over. */
export interface Model {
  readonly generate: (
    systemPrompt: string,
    messages: ReadonlyArray<WireMessage>,
    tools: ReadonlyArray<WireTool>
  ) => Effect.Effect<GenerateResult, unknown>
}

export interface OpenAiConfig {
  readonly api: "openai.chat"
  readonly model: string
  readonly apiKey?: string
  readonly baseURL?: string
  readonly maxOutputTokens?: number
}

export const openaiModel = (config: OpenAiConfig): Model => ({
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

export interface AnthropicConfig {
  readonly api: "anthropic.messages"
  readonly model: string
  readonly apiKey?: string
  readonly authToken?: string
  readonly baseURL?: string
  readonly maxOutputTokens?: number
}

export const anthropicModel = (config: AnthropicConfig): Model => ({
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
          .map((block) => ({ id: block.id ?? "", name: block.name ?? "", input: block.input }))
        return { text, toolCalls }
      },
      catch: (cause) => cause
    })
})

