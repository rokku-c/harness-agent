/**
 * store/poll.ts - SNAPSHOT POLLING.
 *
 * Concept: no event-stream subscription - the store polls the backend
 * snapshots on a timer and the event ring advances one cursor per poll.
 * Failures flip pollOk (the UI shows "stale") but never throw.
 */
import { api } from "../api.ts"
import type { PanelCore } from "./core.ts"
import { adaptEntry } from "./types.ts"

/** poll the whole-console snapshot */
export const pollState = async (core: PanelCore): Promise<void> => {
  try {
    const state = await api.state()
    core.applySnapshot({
      conversations: state.conversations,
      pending: state.pending,
      approvalsOn: state.approvalsOn,
      startedAt: state.startedAt
    })
  } catch {
    core.set({ pollOk: false, polledAt: Date.now() })
  }
}

/** refresh one conversation's timeline from the backend snapshot */
export const pollConversation = async (core: PanelCore, conversationId: string): Promise<void> => {
  try {
    const snap = await api.conversation(conversationId)
    core.putTimeline(conversationId, snap.entries.map((e) => adaptEntry(e)))
  } catch { /* keep what we have */ }
}

/** refresh the currently selected conversation (no-op when none) */
export const pollActive = async (core: PanelCore): Promise<void> => {
  const active = core.getState().activeConversation
  if (active === "") return
  await pollConversation(core, active)
}
