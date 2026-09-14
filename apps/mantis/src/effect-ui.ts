import type { EffectUiView } from "@effect-agent/effect-ui"
import { mantisActions } from "./effect-ui-actions.ts"
import { chatNodes } from "./effect-ui-chat.ts"
import { conversationSection, startNodes } from "./effect-ui-conversations.ts"
import { decisionGate, decisionSection } from "./effect-ui-decisions.ts"
import { eventNodes } from "./effect-ui-events.ts"
import { mantisDoors, mantisHeader } from "./effect-ui-header.ts"
import { failureNotice, loadingRows, region } from "./effect-ui-nodes.ts"
import { recordsNodes } from "./effect-ui-records.ts"

export const effectUiView: EffectUiView = {
  viewId: "mantis-console",
  title: "Mantis",
  state: {
    mantis: {
      state: { conversations: [], pending: [], approvalsOn: false },
      events: [],
      conversation: { entries: [] },
      send: undefined,
      decision: undefined,
      records: { resources: [] },
      recordAdd: undefined,
      recordUpdate: undefined,
      recordDelete: undefined,
    },
    message: { text: "", wait: true },
    start: { id: "ui" },
    recordAdd: { kind: "", text: "" },
    recordEdit: { recordId: "", text: "" },
  },
  sources: [
    { id: "state", url: "/mantis/api/state", state: "/mantis/state", refreshMs: 5000 },
    { id: "events", url: "/mantis/api/events?after=0", state: "/mantis/events", refreshMs: 5000 },
    { id: "records", url: "/mantis/api/workspace", state: "/mantis/records", refreshMs: 10000 },
  ],
  actions: mantisActions,
  nodes: [
    mantisHeader,
    decisionGate,
    mantisDoors,
    region([loadingRows("state", 3), failureNotice("state"), decisionSection, conversationSection]),
  ],
  screens: [
    { id: "conversation", title: "Conversation", onEnter: "mantis.conversation", nodes: chatNodes },
    { id: "start", title: "New conversation", nodes: startNodes },
    { id: "records", title: "Records", nodes: recordsNodes },
    { id: "events", title: "Recent events", nodes: eventNodes },
  ],
}
