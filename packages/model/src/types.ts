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

export const DEFAULT_MAX_OUTPUT_TOKENS = 1024

export interface GenerateResult {
  readonly text: string
  readonly toolCalls: ReadonlyArray<WireToolCall>
}

export interface ModelCapabilities {
  readonly streaming: boolean
  readonly thinking: boolean
  readonly multimodal: boolean
  readonly usage: boolean
}

export interface Model {
  readonly id?: string
  readonly capabilities?: ModelCapabilities
  readonly generate: (
    systemPrompt: string,
    messages: ReadonlyArray<WireMessage>,
    tools: ReadonlyArray<WireTool>
  ) => Effect.Effect<GenerateResult, unknown>
  readonly stream?: (
    systemPrompt: string,
    messages: ReadonlyArray<WireMessage>,
    tools: ReadonlyArray<WireTool>
  ) => Effect.Effect<AsyncIterable<GenerateResult>, unknown>
}

export const echoModel: Model = {
  id: "echo",
  capabilities: { streaming: false, thinking: false, multimodal: false, usage: false },
  generate: (systemPrompt, messages) =>
    Effect.sync(() => ({
      text: JSON.stringify({ echoed: messages.at(-1)?.content ?? "", system: systemPrompt }),
      toolCalls: []
    }))
}
