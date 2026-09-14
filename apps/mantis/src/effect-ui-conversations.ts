import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, emptyRows, field, keyCell, press, row, section, stateRows, table, text, whenRows } from "./effect-ui-nodes.ts"

const conversationCells: readonly UiNodeSpec[] = [
  keyCell("conversationId"),
  keyCell("turns"),
  cellOf(row([press("Open", "mantis.openConversation", { conversationId: { item: "conversationId" } }, { size: "1", variant: "soft" })])),
]

export const conversationSection: UiNodeSpec = section("Conversations", [
  emptyRows("state", "/mantis/state/conversations", "No conversation has been held yet. Send a message from New conversation and it appears here."),
  whenRows(stateRows("/mantis/state/conversations"),
    table(["Conversation", "Turns", "Open"], conversationCells,
      { source: { state: "/mantis/state/conversations" }, key: "conversationId" })),
])

export const startNodes: readonly UiNodeSpec[] = [
  section("Start a conversation", [
    text("Name a conversation this host has not held. It is read like any other, and a pasted address opens the same room.", { size: "2", color: "gray" }),
    field("Conversation id", { component: "TextField.Root", bind: "/start/id" }),
    row([press("Open", "mantis.openConversation", { conversationId: { state: "/start/id" } })]),
  ]),
]
