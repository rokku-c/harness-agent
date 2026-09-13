/**
 * Pending approvals: the calls an agent is waiting on, and the decision that
 * releases them. A call does not run until it is decided, so the decision is the
 * row's own press — the row already holds the call id it addresses — and not a
 * second copy of it in a form under the table, where only one half of the
 * decision could be made. Allow is the decision an operator usually wants;
 * denying is its destructive half, so it reads as the secondary press.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { row } from "@effect-agent/effect-ui"
import { acceptedBadge, errorBadge, refusalBadge } from "./effect-ui-feedback.ts"
import { sharedSourceStates } from "./effect-ui-list.ts"
import { cell, cellOf, codeCell, section, table } from "./effect-ui-nodes.ts"

/**
 * The gate itself, stated once. Approvals being off means a protected call runs
 * with nobody deciding, which is the one thing here worth a signal colour.
 *
 * The badge sits in a row rather than loose on the page: the page's stack is a
 * column, and a column stretches what it holds, so a seven-character badge would
 * paint as a banner across the whole width instead of as a signal beside the
 * title.
 */
export const approvalGate: UiNodeSpec =
  row([{ component: "Badge", props: { variant: "soft", color: "amber", value: "Approvals are disabled" },
    visible: { source: { state: "/mantis/state/approvalsOn" }, equals: false } }])

/**
 * The tool is what the call will run and the session is the conversation it
 * would run in; the call id is the key both presses pass back, so it wears the
 * code chip rather than the head of the row.
 */
const pendingCells: readonly UiNodeSpec[] = [
  cell("tool"),
  codeCell("callId"),
  cell("session"),
  cellOf(row([
    { component: "Button", props: { value: "Allow", size: "1", color: "green" }, onPress: "mantis.allow",
      params: { callId: { item: "callId" }, allow: true } },
    { component: "Button", props: { value: "Deny", size: "1", variant: "soft", color: "red" }, onPress: "mantis.deny",
      params: { callId: { item: "callId" }, allow: false } },
  ])),
]

export const approvalNodes: readonly UiNodeSpec[] = [
  section("Pending approvals", [
    ...sharedSourceStates("state", "/mantis/state/pending", "Nothing is waiting for an approval."),
    table(["Tool", "Call id", "Session", "Decision"], pendingCells,
      { source: { state: "/mantis/state/pending" }, key: "callId" }),
    // a decision's outcome belongs to the section whose rows were pressed
    row([
      acceptedBadge("/mantis/approval/ok", "Approval resolved"),
      refusalBadge("/mantis/approval"),
      errorBadge("/mantis/approval"),
    ]),
  ]),
]
