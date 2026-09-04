/**
 * conversation/contract.ts - the CONVERSATION MEMORY CONTRACT.
 *
 * Concept: per-conversation turns (user/assistant) plus the conversation's
 * meta (extended tools it had enabled). Durability is optional: with a dir,
 * every mutation appends one line to conversations.jsonl and prior lines
 * reload on construction, so memory survives restarts.
 */
export interface Turn {
  readonly role: "user" | "assistant"
  readonly text: string
  readonly ts: number
}

export interface ConversationStoreOptions {
  /** directory holding one append-only JSONL (conversations.jsonl) - turns
   *  persist and reload on construction, so conversation memory survives
   *  process restarts. Omit to keep the store in memory only. */
  readonly dir?: string
}
