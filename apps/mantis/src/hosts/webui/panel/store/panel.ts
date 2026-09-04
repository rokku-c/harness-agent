/**
 * store/panel.ts - the STORE OBJECT + POLL TIMERS.
 *
 * Concept: the store is a single per-page instance: a poll timer keeps the
 * state fragment fresh (700ms), an event timer advances the event-ring
 * cursor (1300ms, ring capped at the last 500 events), and every user
 * action funnels through ./actions.ts then refreshes.
 */
import { api } from "../api.ts"
import { PanelCore } from "./core.ts"
import { pollState, pollConversation, pollActive } from "./poll.ts"
import { send, newConversation, selectConversation, resolveApproval } from "./actions.ts"

export class PanelStore {
  readonly #core = new PanelCore()
  #timer: ReturnType<typeof setInterval> | null = null
  #eventsTimer: ReturnType<typeof setInterval> | null = null
  #eventCursor = 0

  readonly getState = (): ReturnType<PanelCore["getState"]> => this.#core.getState()
  readonly subscribe = (fn: () => void): (() => void) => this.#core.subscribe(fn)

  readonly start = (): (() => void) => {
    if (this.#timer !== null) return () => { /* already running */ }
    void pollState(this.#core)
    void pollActive(this.#core)
    this.#timer = setInterval(() => {
      void pollState(this.#core)
      void pollActive(this.#core)
    }, 700)
    this.#eventsTimer = setInterval(() => {
      void (async () => {
        try {
          const snap = await api.events(this.#eventCursor)
          if (snap.events.length > 0) {
            this.#eventCursor = Math.max(this.#eventCursor, ...snap.events.map((e) => e.ts))
            const state = this.#core.getState()
            const rawEvents = [...state.rawEvents, ...snap.events.map((e) => ({ ts: e.ts, type: e.type, text: e.text ?? "" }))].slice(-500)
            this.#core.set({ rawEvents })
          }
        } catch { /* transient */ }
      })()
    }, 1300)
    return () => {
      if (this.#timer !== null) clearInterval(this.#timer)
      if (this.#eventsTimer !== null) clearInterval(this.#eventsTimer)
      this.#timer = null
      this.#eventsTimer = null
    }
  }

  readonly send = (text: string): Promise<void> => send(this.#core, text)
  readonly newConversation = (): void => newConversation(this.#core)
  readonly selectConversation = (conversationId: string): void => selectConversation(this.#core, conversationId)
  readonly resolveApproval = (callId: string, allow: boolean): Promise<void> => resolveApproval(this.#core, callId, allow)
}
