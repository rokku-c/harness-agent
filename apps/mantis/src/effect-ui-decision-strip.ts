/**
 * The decisions raised in the conversation an operator is reading.
 *
 * A decision used to be answerable only from the start screen, so an operator
 * reading a conversation when one landed had to leave the conversation to answer
 * it and come back to find the agent had been held the whole time (flows §7.3,
 * dead end 1). The strip removes the trip: the same rows and the same two
 * presses, drawn in the room they belong to.
 *
 * The filter is a comparison between two live values — the conversation a
 * decision was raised in, and the one this screen read — so a decision raised
 * elsewhere never appears here, and the strip follows the screen without the app
 * keeping a second copy of the match that could drift from it.
 *
 * The rows are repeated blocks rather than a table, and that is not a style
 * choice: a table draws its header whether or not it has a row, so a
 * conversation with no decision for it would show a header over columns of
 * nothing. A block that matches nothing takes no height at all.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row, rowValue, toneProps } from "./effect-ui-nodes.ts"
import { verdictPresses } from "./effect-ui-decisions.ts"

const stripRow: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { item: "session" }, equals: { state: "/mantis/conversation/conversationId" } },
  children: [
    row([
      { component: "Badge", props: { ...toneProps("pending"), value: "Waiting decision" } },
      rowValue("tool"),
      rowValue("callId", { color: "gray" }),
    ]),
    verdictPresses,
  ],
}

/** Every decision the room is holding, in the order the state source delivered them. */
export const decisionStrip: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  repeat: { source: { state: "/mantis/state/pending" }, key: "callId" },
  children: [stripRow],
}
