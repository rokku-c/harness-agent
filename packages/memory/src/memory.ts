/**
 * Memory: the replaceable long-term memory seam (E10). The contract is
 * remember/recall/promote; implementations may be keyword-scored (default),
 * vector, file or graph. The promotion gate is the nmantis learning ladder
 * (episode → lesson → skill) expressed as a pluggable hook, not a concept.
 */
import { Context, Effect } from "effect"
import { Store } from "@effect-agent/state"
import { randomUUID } from "node:crypto"

export interface MemoryEntry {
  readonly id: string
  readonly content: string
  readonly type: string
  readonly tags: ReadonlyArray<string>
  readonly ts: number
  readonly importance: number
}

export interface RecallResult {
  readonly entry: MemoryEntry
  readonly score: number
}

export interface MemoryService {
  readonly remember: (content: string, type: string, tags?: ReadonlyArray<string>, importance?: number) => Effect.Effect<MemoryEntry>
  readonly recall: (query: string, limit?: number) => Effect.Effect<ReadonlyArray<RecallResult>>
  readonly entries: (type?: string) => Effect.Effect<ReadonlyArray<MemoryEntry>>
  /** Promotion hook: promote from one tier to another (episode→lesson→skill); no-op by default, replaceable implementation */
  readonly promote: (from: string, to: string, entry: MemoryEntry) => Effect.Effect<void>
}

export class Memory extends Context.Tag("effect-agent/Memory")<Memory, MemoryService>() {}

/** Tokenize into lower-cased words for naive relevance scoring. */
const tokens = (text: string): ReadonlyArray<string> =>
  text.toLowerCase().split(/[^a-z0-9\u4e00-\u9fa5]+/).filter((word) => word.length > 0)

const score = (entry: MemoryEntry, queryTokens: ReadonlyArray<string>): number => {
  // substring matching: works for CJK (no word boundaries) and English alike
  const haystack = (entry.content + " " + entry.tags.join(" ")).toLowerCase()
  let overlap = 0
  for (const token of queryTokens) if (haystack.includes(token)) overlap++
  return overlap > 0 ? overlap / Math.sqrt(queryTokens.length) * (1 + entry.importance) : 0
}

/** Default implementation: keyword-scored memory persisted through the Store. */
export const ScopedMemory = Effect.gen(function* () {
  const store = yield* Store
  const service: MemoryService = {
    remember: (content, type, tags = [], importance = 0) =>
      Effect.gen(function* () {
        const entry: MemoryEntry = {
          id: randomUUID(),
          content,
          type,
          tags,
          ts: Date.now(),
          importance
        }
        yield* store.put("memory/" + entry.id, entry)
        return entry
      }),
    recall: (query, limit = 5) =>
      Effect.gen(function* () {
        const all = yield* store.query({ type: undefined, limit: 1000 })
        const queryTokens = tokens(query)
        const entries = all
          .filter((value): value is MemoryEntry => typeof value === "object" && value !== null && "content" in value)
          .map((entry) => ({ entry, score: score(entry, queryTokens) }))
          .filter((result) => result.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit)
        return entries
      }),
    entries: (type) =>
      Effect.map(store.query({ type }), (values) =>
        values.filter((value): value is MemoryEntry => typeof value === "object" && value !== null && "content" in value)
      ),
    promote: () => Effect.void
  }
  return service
})

/** Promotion hook example: counts promotions into an in-memory counter. */
export const promoteHook = (counter: { count: number }) => ({
  promote: (from: string, to: string, _entry: MemoryEntry) =>
    Effect.sync(() => {
      counter.count++
      console.log("[memory] promote " + from + " -> " + to)
    })
})
