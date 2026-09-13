import { region, type EffectUiView } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"
import { chatNodes } from "./effect-ui-chat.ts"
import { approvalGate, approvalNodes } from "./effect-ui-approvals.ts"
import { eventNodes } from "./effect-ui-events.ts"
import { workspaceNodes } from "./effect-ui-workspace.ts"

/**
 * The console's one page, in the order an operator reads it: what the app is,
 * the task it exists for, and then the lists — each with its own source state
 * and its own press outcomes. Every write answers on a result path of its own,
 * so a section reports its presses and nobody else's.
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
    message: { conversationId: "ui", text: "" },
    workspaceAdd: { kind: "", text: "" },
    workspaceEdit: { recordId: "", text: "" },
  },
  sources: [
    { id: "state", url: "/mantis/api/state", state: "/mantis/state", refreshMs: 5000 },
    { id: "events", url: "/mantis/api/events?after=0", state: "/mantis/events", refreshMs: 5000 },
    { id: "workspace", url: "/mantis/api/workspace", state: "/mantis/workspace", refreshMs: 10000 },
  ],
  actions: [
    { name: "mantis.send", method: "POST", url: "/mantis/api/message", result: "/mantis/send", refresh: ["state", "events"] },
    { name: "mantis.conversation", method: "GET", url: "/mantis/api/conversation", result: "/mantis/conversation" },
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
    // The task stays where it is; the lists below it are as long as the app's history
    // is, and how long that is is not the page's business.
    region([...chatNodes, ...approvalNodes, ...workspaceNodes, ...eventNodes]),
  ],
}
