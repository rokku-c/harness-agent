/** typed client for the HTTP shell (every call = one MCP snapshot/action).
 *  State-first: GET endpoints return complete snapshots, never deltas. */
export interface ConvInfo { readonly conversationId: string; readonly turns: number }
export interface PendingItem {
  readonly callId: string
  readonly tool: string
  readonly input: unknown
  /** the conversation (host session) that requested this protected call */
  readonly session?: string
}
export interface StateSnap {
  readonly startedAt: number
  readonly conversations: ConvInfo[]
  readonly pending: PendingItem[]
  readonly approvalsOn: boolean
}
export type BackendEntry =
  | { readonly seq: number; readonly ts: number; readonly kind: "msg"; readonly role: "user" | "assistant"; readonly text: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "tool"; readonly tool: string; readonly state: "call" | "ok" | "fail"; readonly detail?: string }
  | { readonly seq: number; readonly ts: number; readonly kind: "note"; readonly text: string }
export interface ConversationSnap { readonly conversationId: string; readonly entries: BackendEntry[] }
export interface EventsSnap { readonly events: Array<{ ts: number; type: string; text?: string }> }
export interface WorkspaceRecord { readonly id: string; readonly kind: string; readonly text: string; readonly ts: number; readonly source?: string }
export interface WorkspaceResource {
  readonly kind: string
  readonly label: string
  readonly write: { readonly name: string; readonly description: string }
  readonly records: WorkspaceRecord[]
}
export interface SurfaceCapability { readonly name: string; readonly tier: "core" | "extended"; readonly description: string }
export interface WorkspaceSnap { readonly resources: WorkspaceResource[]; readonly capabilities?: SurfaceCapability[] }
export interface Accepted { readonly accepted: boolean; readonly detail?: string }
export interface Resolved { readonly ok: boolean; readonly detail?: string }

const post = (path: string, body: unknown): Promise<unknown> =>
  fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json() as Promise<unknown>)
const get = (path: string): Promise<unknown> => fetch(path).then((r) => r.json() as Promise<unknown>)

export const api = {
  state: (): Promise<StateSnap> => get("/api/state") as Promise<StateSnap>,
  conversation: (conversationId: string): Promise<ConversationSnap> =>
    get("/api/conversation?conversationId=" + encodeURIComponent(conversationId)) as Promise<ConversationSnap>,
  events: (after: number): Promise<EventsSnap> =>
    get("/api/events?after=" + after) as Promise<EventsSnap>,
  send: (conversationId: string, text: string): Promise<Accepted> =>
    post("/api/message", { conversationId, text }) as Promise<Accepted>,
  resolveApproval: (callId: string, allow: boolean): Promise<Resolved> =>
    post("/api/approval/resolve", { callId, allow }) as Promise<Resolved>,
  workspace: (): Promise<WorkspaceSnap> => get("/api/workspace") as Promise<WorkspaceSnap>,
  workspaceAdd: (kind: string, text: string): Promise<Resolved> =>
    post("/api/workspace", { kind, text }) as Promise<Resolved>,
  workspaceUpdate: (recordId: string, text: string): Promise<Resolved> =>
    fetch("/api/workspace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recordId, text }) }).then((r) => r.json() as Promise<Resolved>),
  workspaceDelete: (recordId: string): Promise<Resolved> =>
    fetch("/api/workspace?recordId=" + encodeURIComponent(recordId), { method: "DELETE" }).then((r) => r.json() as Promise<Resolved>)
}
