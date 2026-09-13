/**
 * Mantis's console, in five screens.
 *
 * The first screen is what needs an operator: what is blocked on a decision, and
 * the conversations this console has held. A row's Read enters that
 * conversation's room, and the header's doors open the form that names one the
 * console has not held, the workspace, and the event log.
 *
 * The room is a screen and not a section under the list because working in a
 * conversation is a job: its timeline and the composer that adds to it are one
 * destination an operator enters and comes back from. The same goes for the two
 * lists the console ends with — an operator reads them, and reading is going
 * somewhere (Journey 3, `docs/flows.md`).
 *
 * The console state carries the first screen's two lists, so its read is stated
 * once there and each list says its own emptiness.
 */
import { NAV_ROOT, failureNotice, loadingRows, region, type EffectUiView } from "@effect-agent/effect-ui"
import { mantisHeader } from "./effect-ui-header.ts"
import { chatNodes } from "./effect-ui-chat.ts"
import { conversationCard, startNodes } from "./effect-ui-conversations.ts"
import { approvalCard, approvalGate } from "./effect-ui-approvals.ts"
import { eventNodes } from "./effect-ui-events.ts"
import { workspaceNodes } from "./effect-ui-workspace.ts"

export const effectUiView: EffectUiView = {
  viewId: "mantis-console",
  title: "Mantis",
  state: {
    mantis: {
      state: { conversations: [], pending: [], approvalsOn: false },
      events: [],
      conversation: { entries: [] },
      send: undefined,
      approval: undefined,
      workspace: { resources: [] },
      workspaceAdd: undefined,
      workspaceUpdate: undefined,
      workspaceDelete: undefined,
    },
    message: { text: "" },
    start: { id: "ui" },
    workspaceAdd: { kind: "", text: "" },
    workspaceEdit: { recordId: "", text: "" },
  },
  sources: [
    { id: "state", url: "/mantis/api/state", state: "/mantis/state", refreshMs: 5000 },
    { id: "events", url: "/mantis/api/events?after=0", state: "/mantis/events", refreshMs: 5000 },
    { id: "workspace", url: "/mantis/api/workspace", state: "/mantis/workspace", refreshMs: 10000 },
  ],
  actions: [
    // The turn is waited out rather than fired: the console has no event stream
    // to catch the reply on, so the reply is read back by the room's own read —
    // which this press runs again, once the turn has ended and there is one.
    { name: "mantis.send", method: "POST", url: "/mantis/api/message", result: "/mantis/send",
      params: { wait: true }, clear: ["/message/text"], refresh: ["state", "events", "mantis.conversation"] },
    // Nothing to read on the way in: a room is filled by its own read below, so
    // a press that names a conversation only names it.
    { name: "mantis.openConversation", opens: "conversation" },
    { name: "mantis.newConversation", opens: "start" },
    { name: "mantis.openWorkspace", opens: "workspace" },
    { name: "mantis.openEvents", opens: "events" },
    // The room's own read. The id comes from the address, which is where a press
    // put it, so a row's Read and the Start form are one read with two doors
    // (`Formal/Door.lean`) — and a read with no conversation named makes no call
    // at all rather than asking about a conversation nobody chose.
    { name: "mantis.conversation", method: "GET", url: "/mantis/api/conversation?conversationId={conversationId}",
      result: "/mantis/conversation", params: { conversationId: { state: `${NAV_ROOT}/conversationId` } },
      clear: ["/message/text"] },
    { name: "mantis.allow", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/approval", refresh: ["state", "events"] },
    { name: "mantis.deny", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/approval", refresh: ["state", "events"] },
    { name: "mantis.workspaceAdd", method: "POST", url: "/mantis/api/workspace", result: "/mantis/workspaceAdd", refresh: ["workspace"] },
    { name: "mantis.workspaceUpdate", method: "PATCH", url: "/mantis/api/workspace", result: "/mantis/workspaceUpdate", refresh: ["workspace"] },
    { name: "mantis.workspaceDelete", method: "DELETE", url: "/mantis/api/workspace?recordId={recordId}", result: "/mantis/workspaceDelete", refresh: ["workspace"] },
  ],
  nodes: [
    mantisHeader,
    // A page-wide fact rather than a row's state: approvals being off is the one
    // thing here worth a signal, and it holds for the whole console.
    approvalGate,
    // The lists below are as long as the app's history is, and how long that is
    // is not the page's business: they scroll in their own box.
    region([
      // the console's own read, once, above the two lists it feeds
      loadingRows("state", 3),
      failureNotice("state"),
      // A call does not run until it is decided, so the blocked work comes first.
      approvalCard,
      conversationCard,
    ]),
  ],
  screens: [
    { id: "conversation", title: "Conversation", onEnter: "mantis.conversation", nodes: chatNodes },
    { id: "start", title: "New conversation", nodes: startNodes },
    { id: "workspace", title: "Workspace", nodes: workspaceNodes },
    { id: "events", title: "Recent events", nodes: eventNodes },
  ],
}
