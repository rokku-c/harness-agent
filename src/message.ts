/**
 * Message and turn types - the session log facts shared by connections
 * (provider connections generate over them) and agents (they own the log).
 */
export type Message =
  | { readonly role: "user"; readonly content: string }
  | {
      readonly role: "assistant"
      readonly content: string
      /** The calls the model made - real wires require them on the assistant message. */
      readonly toolCalls?: ReadonlyArray<LlmToolCall>
    }
  /** The tool result correlates to its call by id (real protocols require it). */
  | { readonly role: "tool"; readonly id: string; readonly name: string; readonly content: string }

export interface Turn {
  readonly index: number
  readonly messages: ReadonlyArray<Message>
  readonly status: "complete" | "max-steps"
}

export interface LlmToolCall {
  readonly id: string
  readonly name: string
  readonly input: unknown
}

/** One model generation result: the assistant text plus any tool calls. */
export interface GenerateResult {
  readonly text: string
  readonly toolCalls: ReadonlyArray<LlmToolCall>
}
