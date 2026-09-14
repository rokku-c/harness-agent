/**
 * The conversations this console has held, and the door to one it has not.
 *
 * The list is the start screen's own: it is what an operator comes back for, and
 * a row is the only way into a room besides pasting its address. The row's Open
 * carries the conversation id into the screen it enters, and the screen's own
 * read consumes it, so a row and a pasted address arrive at the same room by the
 * same read rather than by two that could answer differently.
 *
 * The form that names a conversation this console has not held is a screen of
 * its own and not a field under the list: it is a task finished or abandoned,
 * and the list above it is as long as the host's history, so an operator who came
 * to name a new one would scroll past every old one to reach it.
 */

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

/** The form that names one this console has not held. The room's own read reports on what it fills. */
export const startNodes: readonly UiNodeSpec[] = [
  section("Start a conversation", [
    text("Name a conversation this host has not held. It is read like any other, and a pasted address opens the same room.", { size: "2", color: "gray" }),
    field("Conversation id", { component: "TextField.Root", bind: "/start/id" }),
    row([press("Open", "mantis.openConversation", { conversationId: { state: "/start/id" } })]),
  ]),
]
