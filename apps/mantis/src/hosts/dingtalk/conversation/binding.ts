/**
 * conversation/binding.ts - HISTORY RENDERING + the memory binding.
 *
 * Concept: turns become a compact transcript (oldest first, most recent
 * last) and a read-only Binding carries it into the mantis session context
 * on every run. Effect.sync (NOT succeed): content must be re-rendered on
 * each materialize, otherwise the snapshot taken at session creation would
 * be frozen forever and the agent would never see its later turns.
 */
import { Effect } from "effect"
import { eaUri, type Binding, type Content } from "@effect-agent/core"
import type { Turn } from "./contract.ts"

/** render recent turns as a compact transcript (oldest first) */
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
