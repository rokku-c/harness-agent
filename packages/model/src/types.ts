/**
 * The model contract: what a loop engine needs from a provider.
 * Providers are configuration, not architecture - the agent API never
 * names a provider. Wire types are plain data; the Model interface carries
 * declared capabilities so a replacement can be contract-checked (M3).
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

/** Declared model capabilities - replacement safety net (M3). */
export interface ModelCapabilities {
  readonly streaming: boolean
  readonly thinking: boolean
  readonly multimodal: boolean
  readonly usage: boolean
}

/**
 * The model surface a driver loops over. id/capabilities are optional so
 * bare generate-only fakes keep working; real providers declare them, and
 * ModelLayer.require treats an absent declaration as "no capability" -
 * the fail-loud direction (M3).
 */
export interface Model {
  readonly id?: string
  readonly capabilities?: ModelCapabilities
  readonly generate: (
    systemPrompt: string,
    messages: ReadonlyArray<WireMessage>,
    tools: ReadonlyArray<WireTool>
  ) => Effect.Effect<GenerateResult, unknown>
  /** Optional streaming surface; drivers that need it check capabilities.streaming first. */
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
