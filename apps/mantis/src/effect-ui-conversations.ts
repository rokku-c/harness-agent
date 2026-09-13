/**
 * The conversations this console has held, and the door to one it has not.
 *
 * The list is the first screen's own: it is what an operator comes back for. A
 * row's Read leaves it for that conversation's room (`effect-ui-chat.ts`), which
 * is where the timeline and the composer are, so the read that fills them is the
 * screen's own and a row and an address pasted into the bar are the same arrival.
 *
 * The form naming a conversation this console has not held is a screen of its
 * own, and it reaches the same room by the same read: one read, two doors, and
 * the value belongs to the press. It is a screen rather than a section under the
 * list because it is a task finished or abandoned, and because the list above it
 * is as long as the console's history.
 */

import { emptyRows, row, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, codeCell, field, press, section, table, text } from "./effect-ui-nodes.ts"

const conversationCells: readonly UiNodeSpec[] = [
  codeCell("conversationId"),
  cell("turns"),
  cellOf(row([press("Read", "mantis.openConversation", { conversationId: { item: "conversationId" } }, { size: "1" })])),
]

export const conversationCard: UiNodeSpec = section("Conversations", [
  emptyRows("state", "/mantis/state/conversations", "No conversation has been held yet."),
  whenRows(stateRows("/mantis/state/conversations"),
    table(["Conversation", "Turns", "Action"], conversationCells,
      { source: { state: "/mantis/state/conversations" }, key: "conversationId" })),
])

/** The form that names one this console has not held. The read reports on the room it fills. */
export const startNodes: readonly UiNodeSpec[] = [
  section("Start a conversation", [
    text("Name a conversation this console has not held. It is read from the platform like any other.", { size: "2", color: "gray" }),
    field("Conversation id", { component: "TextField.Root", bind: "/start/id" }),
    row([press("Start", "mantis.openConversation", { conversationId: { state: "/start/id" } })]),
  ]),
]
