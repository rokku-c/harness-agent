import { region, type EffectUiView } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"
import { chatNodes } from "./effect-ui-chat.ts"
import { conversationNodes } from "./effect-ui-conversations.ts"
import { approvalGate, approvalNodes } from "./effect-ui-approvals.ts"
import { eventNodes } from "./effect-ui-events.ts"
import { workspaceNodes } from "./effect-ui-workspace.ts"

/**
 * The console's one page, in the order an operator reads it: what the app is,
 * what needs attention, the doors into a conversation, the conversation itself,
 * and then the lists — each with its own source state and its own press
 * outcomes. Every write answers on a result path of its own, so a section
 * reports its presses and nobody else's.
 */
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
    // to catch the reply on, so the reply is read back by the timeline's own read
    // — which this press runs again, once the turn has ended and there is one.
    { name: "mantis.send", method: "POST", url: "/mantis/api/message", result: "/mantis/send",
      params: { wait: true }, clear: ["/message/text"], refresh: ["state", "events", "mantis.conversation"] },
    // One read, two doors: a row names the conversation by the key it holds, and
    // the field beside the Start press names one this console has not held. Both
    // answer where the timeline reads. The id it re-reads is the one it last
    // answered for, so the presses that change a transcript — sending a turn —
    // run this again for the conversation on screen, and a read with no
    // conversation to read makes no call at all.
    { name: "mantis.conversation", method: "GET", url: "/mantis/api/conversation?conversationId={conversationId}",
      result: "/mantis/conversation", params: { conversationId: { state: "/mantis/conversation/conversationId" } },
      clear: ["/message/text"] },
    { name: "mantis.allow", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/approval", refresh: ["state", "events"] },
    { name: "mantis.deny", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/approval", refresh: ["state", "events"] },
    { name: "mantis.workspaceAdd", method: "POST", url: "/mantis/api/workspace", result: "/mantis/workspaceAdd", refresh: ["workspace"] },
    { name: "mantis.workspaceUpdate", method: "PATCH", url: "/mantis/api/workspace", result: "/mantis/workspaceUpdate", refresh: ["workspace"] },
    { name: "mantis.workspaceDelete", method: "DELETE", url: "/mantis/api/workspace?recordId={recordId}", result: "/mantis/workspaceDelete", refresh: ["workspace"] },
  ],
  nodes: [
    heading("Mantis", { size: "6" }),
    text("Human-agent conversations, approvals, and workspace records.", { size: "2", color: "gray" }),
    approvalGate,
    // The doors come before the room they open: a press reports its failure where
    // it was made, and the conversation it read shows under the rows that chose
    // it rather than above them. The task stays where it is; the lists below are
    // as long as the app's history is, and how long that is is not the page's
    // business.
    region([...conversationNodes, ...chatNodes, ...approvalNodes, ...workspaceNodes, ...eventNodes]),
  ],
}
