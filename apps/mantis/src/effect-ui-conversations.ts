/**
 * The conversations this console has held, and the door to one it has not.
 *
 * A row's Read and the Start press are the same read, and the two differ only in
 * where the id comes from: the row's own key, or the field beside the press. Both
 * answer on the timeline's path, so which door was used leaves no trace — and
 * both are reported here when the read fails, because here is where the presses
 * are. The read is a press and not a source, so it is also the one place a
 * refusal from the timeline can be read from.
 */

import { row, stateRows, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { errorBadge } from "./effect-ui-feedback.ts"
import { sharedSourceStates } from "./effect-ui-list.ts"
import { cell, cellOf, codeCell, field, press, section, table } from "./effect-ui-nodes.ts"

const conversationCells: readonly UiNodeSpec[] = [
  codeCell("conversationId"),
  cell("turns"),
  cellOf(row([press("Read", "mantis.conversation", { conversationId: { item: "conversationId" } }, { size: "1" })])),
]

/** The door to a conversation this console has not held: the read is what names it. */
const start: UiNodeSpec = section("Start a conversation", [
  field("Conversation id", { component: "TextField.Root", bind: "/start/id" }),
  row([press("Start", "mantis.conversation", { conversationId: { state: "/start/id" } })]),
])

export const conversationNodes: readonly UiNodeSpec[] = [
  // the held ones first: they are what an operator comes back for, and the form
  // below them is the escape hatch for a conversation this console has not held
  section("Conversations", [
    ...sharedSourceStates("state", "/mantis/state/conversations", "No conversation has been held yet."),
    whenRows(stateRows("/mantis/state/conversations"),
      table(["Conversation", "Turns", "Action"], conversationCells,
        { source: { state: "/mantis/state/conversations" }, key: "conversationId" })),
    // a read that failed is reported by the section whose rows were pressed
    row([errorBadge("/mantis/conversation")]),
  ]),
  start,
]
