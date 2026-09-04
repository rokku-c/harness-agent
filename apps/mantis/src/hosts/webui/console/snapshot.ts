/**
 * console/snapshot.ts - SNAPSHOT READERS over the console state.
 *
 * Concept: the panel never subscribes to an event stream - it polls
 * snapshots (conversations + counts, pending approvals, agent-UI latest/
 * versions, approvalsOn) and renders them. Readers are pure over the seams
 * they name; nothing reconnects or dedupes on the client.
 */
import type { ManualGate, PendingApproval } from "@effect-agent/gate"
import type { UiStore } from "../ui-store.ts"
import type { MantisHost } from "../../dingtalk/host.ts"
import type { WorkKind } from "../../../workspace.ts"
import type { NotesStore } from "../../../tools.ts"
import type { TimelineLedger } from "./ledger.ts"
import { WORKSPACE_CONVERSATION, type ConsoleTimelineEntry } from "./types.ts"
import { pendingApprovals } from "./approvals.ts"

/** full timeline of one conversation; after a restart the live ledger is
 *  gone, so the durable conversation memory renders history instead */
export const timelineOf = (
  ledger: TimelineLedger,
  host: MantisHost,
  conversationId: string
): ReadonlyArray<ConsoleTimelineEntry> => {
  const live = ledger.liveTimeline(conversationId)
  if (live !== undefined) return live
  return host.conversations.history(conversationId).map((turn, index) => ({
    seq: index + 1,
    ts: turn.ts,
    kind: "msg" as const,
    role: turn.role,
    text: turn.text
  }))
}

export const conversationsOf = (host: MantisHost, ledger: TimelineLedger): Array<{ conversationId: string; turns: number }> => {
  const ids = new Set<string>([...ledger.ids(), ...host.conversations.conversationIds()])
  return [...ids].map((id) => ({
    conversationId: id,
    turns: ledger.msgCount(id) > 0 ? ledger.msgCount(id) : host.conversations.history(id).length
  }))
}

export const pendingOf = (gate: ManualGate | undefined): ReadonlyArray<PendingApproval> => pendingApprovals(gate)

/** the human console's shared workspace: one host session whose store holds
 *  every declared resource kind. The operator writes from the UI directly;
 *  agent sessions share it when they use this conversation. */
export const workspaceSurface = (host: MantisHost, notes: NotesStore | undefined) => ({
  records: (kind?: WorkKind) =>
    kind === undefined
      ? (notes ?? host.session(WORKSPACE_CONVERSATION).notes).all()
      : (notes ?? host.session(WORKSPACE_CONVERSATION).notes).search("", kind),
  append: (kind: WorkKind, text: string) =>
    (notes ?? host.session(WORKSPACE_CONVERSATION).notes).add(kind, text, "ui"),
  update: (id: string, text: string) =>
    (notes ?? host.session(WORKSPACE_CONVERSATION).notes).update(id, text),
  remove: (id: string) =>
    (notes ?? host.session(WORKSPACE_CONVERSATION).notes).remove(id)
})

export const consoleState = (
  host: MantisHost,
  ledger: TimelineLedger,
  ui: UiStore,
  gate: ManualGate | undefined,
  startedAt: number
) => {
  const versions = ui.versions()
  const latest = ui.latest()
  return {
    startedAt,
    conversations: conversationsOf(host, ledger),
    pending: pendingOf(gate).map((pending) => ({ callId: pending.callId, tool: pending.input.tool, input: pending.input.input, session: pending.input.session })),
    ui: latest === undefined
      ? { empty: true }
      : { empty: false, version: versions[0]!.n, author: versions[0]!.author },
    approvalsOn: gate !== undefined
  }
}
