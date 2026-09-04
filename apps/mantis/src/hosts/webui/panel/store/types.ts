/**
 * store/types.ts - the PANEL STATE CONTRACT.
 *
 * Concept: state-first - the backend owns every snapshot (conversation
 * timelines incl. tool steps, pending approvals, agent-UI versions, the
 * event ring); the panel renders whatever the latest snapshot says. This
 * file owns the UI-facing shapes: the merged timeline item, the poll
 * fragment snapshot, and the full PanelState rendered by views.
 */
import type { BackendEntry, ConvInfo, PendingItem, UiVersionMeta } from "../api.ts"

export type TimelineItem =
  | { readonly kind: "msg"; readonly role: "user" | "assistant"; readonly text: string; readonly ts: number }
  | { readonly kind: "tool"; readonly tool: string; readonly state: "call" | "ok" | "fail"; readonly detail?: string; readonly ts: number }
  | { readonly kind: "note"; readonly text: string; readonly ts: number }

export interface RawEvent { readonly ts: number; readonly type: string; readonly text: string }

export interface PanelState {
  /** fresh = the last poll succeeded and is recent */
  readonly pollOk: boolean
  readonly polledAt: number
  readonly startedAt?: number
  readonly approvalsOn: boolean
  readonly serverConversations: ConvInfo[]
  readonly timelines: Readonly<Record<string, ReadonlyArray<TimelineItem>>>
  /** locally-generated notes (send failures) - the backend has no state for them */
  readonly notes: Readonly<Record<string, ReadonlyArray<{ text: string; ts: number }>>>
  readonly activeConversation: string
  readonly pending: ReadonlyArray<PendingItem>
  readonly uiEmpty: boolean
  readonly uiVersion?: number
  readonly uiAuthor?: string
  readonly uiMessages: ReadonlyArray<unknown> | null
  readonly uiVersions: ReadonlyArray<UiVersionMeta>
  readonly rawEvents: ReadonlyArray<RawEvent>
}

/** one poll's fetched fragment (conversations + ui + approvals) */
export interface Snapshot {
  conversations: ConvInfo[]
  pending: PendingItem[]
  approvalsOn: boolean
  startedAt?: number
  uiEmpty: boolean
  uiVersion?: number
  uiAuthor?: string
  uiMessages: unknown[] | null
  uiVersions: UiVersionMeta[]
}

export const EMPTY_SNAPSHOT: Snapshot = { conversations: [], pending: [], approvalsOn: false, uiEmpty: true, uiMessages: null, uiVersions: [] }

/** the initial PanelState (before the first poll) */
export const initialState = (): PanelState => ({
  pollOk: false,
  polledAt: 0,
  approvalsOn: false,
  serverConversations: [],
  timelines: {},
  notes: {},
  activeConversation: "",
  pending: [],
  uiEmpty: true,
  uiMessages: null,
  uiVersions: [],
  rawEvents: []
})

/** map a backend timeline entry onto the UI model */
export const adaptEntry = (entry: BackendEntry): TimelineItem => {
  if (entry.kind === "msg") return { kind: "msg", role: entry.role, text: entry.text, ts: entry.ts }
  if (entry.kind === "note") return { kind: "note", text: entry.text, ts: entry.ts }
  return { kind: "tool", tool: entry.tool, state: entry.state, detail: entry.detail, ts: entry.ts }
}
