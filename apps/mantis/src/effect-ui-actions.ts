import { NAV_ROOT, type UiActionSpec } from "@effect-agent/effect-ui"

export const mantisActions: readonly UiActionSpec[] = [
  { name: "mantis.send", method: "POST", url: "/mantis/api/message", result: "/mantis/send",
    params: { wait: { state: "/message/wait" } }, clear: ["/message/text"],
    refresh: ["state", "events", "mantis.conversation"] },
  { name: "mantis.openConversation", opens: "conversation" },
  { name: "mantis.newConversation", opens: "start" },
  { name: "mantis.openRecords", opens: "records" },
  { name: "mantis.openEvents", opens: "events" },
  { name: "mantis.conversation", method: "GET", url: "/mantis/api/conversation?conversationId={conversationId}",
    result: "/mantis/conversation", params: { conversationId: { state: `${NAV_ROOT}/conversationId` } },
    clear: ["/message/text"] },
  { name: "mantis.allow", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/decision", refresh: ["state", "events"] },
  { name: "mantis.deny", method: "POST", url: "/mantis/api/approval/resolve", result: "/mantis/decision", refresh: ["state", "events"] },
  { name: "mantis.recordAdd", method: "POST", url: "/mantis/api/workspace", result: "/mantis/recordAdd", refresh: ["records"] },
  { name: "mantis.recordUpdate", method: "PATCH", url: "/mantis/api/workspace", result: "/mantis/recordUpdate", refresh: ["records"] },
  { name: "mantis.recordDelete", method: "DELETE", url: "/mantis/api/workspace?recordId={recordId}", result: "/mantis/recordDelete", refresh: ["records"] },
]
