/**
 * store/actions.ts - USER ACTIONS (act, then refresh the affected snapshot).
 *
 * Concept: every action either optimistically flips local state (selection,
 * local notes on send failure) or calls the backend and lets the next poll
 * settle the truth; failures never throw into the view.
 */
import { api } from "../api.ts"
import type { PanelCore } from "./core.ts"
import { pollState, pollConversation } from "./poll.ts"

export const send = async (core: PanelCore, text: string): Promise<void> => {
  const conversationId = core.getState().activeConversation || "ui"
  if (conversationId !== core.getState().activeConversation) core.set({ activeConversation: conversationId })
  try {
    const result = await api.send(conversationId, text)
    if (result.accepted !== true) core.pushNote(conversationId, "(not accepted: " + (result.detail ?? "?") + ")")
  } catch (error) {
    core.pushNote(conversationId, "(send failed: " + String(error) + ")")
  }
  await pollConversation(core, conversationId)
  void pollState(core)
}

export const newConversation = (core: PanelCore): void => {
  const conversationId = "web-" + Date.now().toString(36)
  core.set({ activeConversation: conversationId })
}

export const selectConversation = (core: PanelCore, conversationId: string): void => {
  if (conversationId === core.getState().activeConversation) return
  core.set({ activeConversation: conversationId })
  if (!core.isConversationLoaded(conversationId)) void pollConversation(core, conversationId)
}

export const resolveApproval = async (core: PanelCore, callId: string, allow: boolean): Promise<void> => {
  try { await api.resolveApproval(callId, allow) } catch { /* poll settles */ }
  void pollState(core)
}

export const uiRestore = async (core: PanelCore, version: number): Promise<void> => {
  try { await api.uiRestore(version) } catch { /* poll settles */ }
  void pollState(core)
}

export const uiAction = (core: PanelCore, action: string, values: Record<string, string>): void => {
  const conversationId = core.getState().activeConversation || "ui"
  void api.uiAction(conversationId, action, values)
}
