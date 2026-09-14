import { Effect } from "effect"
import { eaUri, type Binding, type Content } from "@effect-agent/core"
import type { Turn } from "./contract.ts"

export const renderHistory = (history: ReadonlyArray<Turn>, maxTurns = 30): string => {
  const turns = history.slice(-maxTurns)
  if (turns.length === 0) return "No prior conversation in this session."
  return (
    "Conversation history (most recent last):\n" +
    turns.map((turn) => (turn.role === "user" ? "user: " : "mantis: ") + turn.text).join("\n")
  )
}

export const historyBinding = (
  conversationId: string,
  read: () => string
): Binding<never, never, never> => ({
  uri: eaUri("conv", "history", conversationId),
  read: Effect.sync(() => ({ _tag: "Text", text: read() } as Content))
})
