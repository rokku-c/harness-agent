import type { Turn } from "../../dingtalk/conversation/contract.ts"
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

  readonly begin = (conversationId: string, history: ReadonlyArray<Turn>): void => {
    this.#conversations.add(conversationId)
    if (this.#timelines.has(conversationId)) return
    this.#timelines.set(
      conversationId,
      history.map((turn, index) => ({ seq: index + 1, ts: turn.ts, kind: "msg" as const, role: turn.role, text: turn.text }))
    )
    this.#seqs.set(conversationId, history.length)
  }

  readonly recordMessage = (conversationId: string, role: "user" | "assistant", text: string, ts: number): void => {
    this.#append(conversationId, { ts, kind: "msg", role, text })
  }

  readonly recordNote = (conversationId: string, text: string): void => {
    this.#append(conversationId, { ts: Date.now(), kind: "note", text })
  }

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
