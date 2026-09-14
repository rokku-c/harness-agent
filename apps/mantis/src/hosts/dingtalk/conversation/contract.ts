export interface Turn {
  readonly role: "user" | "assistant"
  readonly text: string
  readonly ts: number
}

export interface ConversationStoreOptions {
  readonly dir?: string
}
