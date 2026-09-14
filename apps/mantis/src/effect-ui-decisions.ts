/**
 * The decisions holding a call up, and the verdict that releases them.
 *
 * A protected call does not run until it is decided, so the verdict is the row's
 * own press: the row already holds the call id a verdict addresses, and a second
 * copy of that id in a form under the table is how half a decision gets answered
 * somewhere other than where it was read. Allow is the verdict an operator
 * usually wants, so it takes the accent; deny is the destructive half and reads
 * as the secondary press.
 *
 * Both verdicts answer into one result path, because they are one decision: two
 * paths would let the outcome of a deny sit on screen beside the rows of an
 * allow, and a reader would have no way to tell which of the two the sentence
 * belonged to.
 *
 * The gate is a page-wide fact rather than a row's, and it carries the amber
 * tone because it is the one state here in which a decision that should be
 * outstanding is not: with the gate off a protected call runs with nobody
 * deciding.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, emptyRows, keyCell, press, row, section, stateRows, table, text, whenRows } from "./effect-ui-nodes.ts"
import { outcome } from "./effect-ui-feedback.ts"

/** Where a verdict lands, whichever one it was. */
export const DECISION_RESULT = "/mantis/decision"

/**
 * The two verdicts one decision admits. Written once and pressed from two
 * screens — this table and the strip inside a conversation — so the two cannot
 * come to word a verdict differently, and so a decision never grows a third
 * answer in one place and not the other.
 */
export const verdictPresses: UiNodeSpec = row([
  press("Allow", "mantis.allow", { callId: { item: "callId" }, allow: true }, { size: "1" }),
  press("Deny", "mantis.deny", { callId: { item: "callId" }, allow: false }, { size: "1", variant: "soft", color: "red" }),
])

const decisionCells: readonly UiNodeSpec[] = [
  keyCell("tool"),
  keyCell("callId"),
  keyCell("session"),
  cellOf(verdictPresses),
]

export const decisionSection: UiNodeSpec = section("Waiting decisions", [
  emptyRows("state", "/mantis/state/pending", "No call is waiting on a verdict. A protected call appears here while it is held."),
  whenRows(stateRows("/mantis/state/pending"),
    table(["Operation", "Call", "Conversation", "Verdict"], decisionCells,
      { source: { state: "/mantis/state/pending" }, key: "callId" })),
  row(outcome(DECISION_RESULT, `${DECISION_RESULT}/ok`, "Verdict recorded")),
])

/**
 * The gate, stated once, above everything it governs.
 *
 * The guard is on the row rather than on each of its two nodes, so the badge and
 * the sentence that explains it can never disagree about whether the gate is
 * off. The row is a row and not the column it looks like it wants: a column
 * stretches what it holds, and a seven-character badge would paint as a banner
 * across the page instead of as a signal beside its explanation.
 */
export const decisionGate: UiNodeSpec = {
  ...row([
    { component: "Badge", props: { variant: "soft", color: "amber", highContrast: true, value: "Decisions are disabled" } },
    text("A protected call runs with nobody deciding while the gate is off.", { size: "2", color: "gray" }),
  ]),
  visible: { source: { state: "/mantis/state/approvalsOn" }, equals: false },
}
