/**
 * store/selectors.ts - PURE VIEW SELECTORS over PanelState.
 *
 * Concept: views never touch the store object - they call usePanel() for the
 * latest snapshot and derive everything here: the conversation list (backend
 * order), one conversation's full timeline (backend entries + local notes
 * spliced in by timestamp), and the effective conversation to render.
 */
import { useSyncExternalStore } from "react"
import { panel } from "./singleton.ts"
import type { PanelState, TimelineItem } from "./types.ts"

export const usePanel = (): PanelState => useSyncExternalStore(panel.subscribe, panel.getState)

/** conversation ids with the backend's turn count, most recent first */
export const conversationList = (state: PanelState): Array<{ conversationId: string; turns: number }> => [...state.serverConversations]

/** full timeline of a conversation: backend entries + local notes */
export const conversationItems = (state: PanelState, conversationId: string): ReadonlyArray<TimelineItem> => {
  const base = state.timelines[conversationId] ?? []
  const notes = state.notes[conversationId] ?? []
  if (notes.length === 0) return base
  // notes carry no backend seq; splice by timestamp into the timeline
  const merged: TimelineItem[] = [...base]
  for (const note of notes) {
    const at = merged.findIndex((item) => item.ts > note.ts)
    if (at === -1) merged.push({ kind: "note", ...note })
    else merged.splice(at, 0, { kind: "note", ...note })
  }
  return merged
}

export const defaultConversation = (state: PanelState): string =>
  state.activeConversation || (conversationList(state)[0]?.conversationId ?? "ui")
