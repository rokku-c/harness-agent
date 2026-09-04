/**
 * store/core.ts - the PANEL STATE CONTAINER.
 *
 * Concept: the single mutable nucleus behind the store - current PanelState,
 * listener set for useSyncExternalStore, the per-conversation timeline cache
 * (what has been loaded so far) and the local-notes ledger. Views only read
 * through getState/subscribe; every mutation funnels through #set + notify.
 */
import { EMPTY_SNAPSHOT, initialState, type PanelState, type Snapshot, type TimelineItem } from "./types.ts"

export class PanelCore {
  #listeners = new Set<() => void>()
  #state: PanelState = initialState()
  readonly #loadedConversations = new Set<string>()
  readonly #loadedDetail: Record<string, TimelineItem[]> = {}
  #fragment = EMPTY_SNAPSHOT

  readonly getState = (): PanelState => this.#state
  readonly subscribe = (fn: () => void): (() => void) => {
    this.#listeners.add(fn)
    return () => this.#listeners.delete(fn)
  }
  #notify(): void {
    for (const fn of this.#listeners) fn()
  }
  readonly set = (partial: Partial<PanelState>): void => {
    this.#state = { ...this.#state, ...partial }
    this.#notify()
  }
  readonly applySnapshot = (snap: Snapshot): void => {
    this.#fragment = snap
    this.set({
      pollOk: true,
      polledAt: Date.now(),
      startedAt: snap.startedAt,
      approvalsOn: snap.approvalsOn,
      serverConversations: snap.conversations,
      pending: snap.pending,
      uiEmpty: snap.uiEmpty,
      uiVersion: snap.uiVersion,
      uiAuthor: snap.uiAuthor,
      uiMessages: snap.uiMessages,
      uiVersions: snap.uiVersions
    })
  }
  readonly isConversationLoaded = (conversationId: string): boolean => this.#loadedConversations.has(conversationId)
  /** keep the whole cached detail set as the timelines slice */
  readonly putTimeline = (conversationId: string, entries: TimelineItem[]): void => {
    this.#loadedConversations.add(conversationId)
    this.#loadedDetail[conversationId] = entries
    this.set({ timelines: { ...this.#loadedDetail } })
  }
  readonly pushNote = (conversationId: string, text: string): void => {
    const notes = this.#state.notes[conversationId] ?? []
    this.set({ notes: { ...this.#state.notes, [conversationId]: [...notes.slice(-20), { text, ts: Date.now() }] } })
  }
}
