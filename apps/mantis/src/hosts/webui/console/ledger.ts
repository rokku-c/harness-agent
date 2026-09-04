/**
 * console/ledger.ts - the CONVERSATION TIMELINE LEDGER.
 *
 * Concept: the console IS the state. Each conversation keeps an immutable,
 * bounded timeline (msg/tool/note entries in order, capped at 400 per
 * conversation) plus the set of known conversation ids. Reads never mutate.
 */
import type { ConsoleTimelineEntry } from "./types.ts"

export class TimelineLedger {
  readonly #conversations = new Set<string>()
  readonly #timelines = new Map<string, ConsoleTimelineEntry[]>()
  readonly #seqs = new Map<string, number>()

  #nextSeq(conversationId: string): number {
    const seq = (this.#seqs.get(conversationId) ?? 0) + 1
    this.#seqs.set(conversationId, seq)
    return seq
  }

  #append<K extends ConsoleTimelineEntry["kind"]>(
    conversationId: string,
    entry: { kind: K } & Omit<Extract<ConsoleTimelineEntry, { readonly kind: K }>, "seq">
  ): void {
    const withSeq = { ...entry, seq: this.#nextSeq(conversationId) } as unknown as ConsoleTimelineEntry
    const items = this.#timelines.get(conversationId) ?? []
    items.push(withSeq)
    if (items.length > 400) items.shift()
    this.#timelines.set(conversationId, items)
  }

  readonly begin = (conversationId: string): void => {
    this.#conversations.add(conversationId)
  }

  readonly recordMessage = (conversationId: string, role: "user" | "assistant", text: string, ts: number): void => {
    this.#append(conversationId, { ts, kind: "msg", role, text })
  }

  /** a failed turn leaves a visible note in the conversation timeline */
  readonly recordNote = (conversationId: string, text: string): void => {
    this.#append(conversationId, { ts: Date.now(), kind: "note", text })
  }

  /** tool steps are attributed to the conversation currently driving a turn */
  readonly recordTool = (conversationId: string, tool: string, state: "call" | "ok" | "fail", detail: string | undefined): void => {
    this.#append(conversationId, { ts: Date.now(), kind: "tool", tool, state, detail })
  }

  readonly liveTimeline = (conversationId: string): ReadonlyArray<ConsoleTimelineEntry> | undefined => {
    const live = this.#timelines.get(conversationId)
    return live !== undefined && live.length > 0 ? [...live] : undefined
  }

  readonly ids = (): ReadonlyArray<string> => [...this.#conversations]
  readonly msgCount = (conversationId: string): number =>
    (this.#timelines.get(conversationId) ?? []).filter((e) => e.kind === "msg").length
}
