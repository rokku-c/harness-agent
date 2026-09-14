import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { cellOf, emptyRows, keyCell, press, row, section, stateRows, table, text, whenRows } from "./effect-ui-nodes.ts"
import { outcome } from "./effect-ui-feedback.ts"

export const DECISION_RESULT = "/mantis/decision"

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

export const decisionGate: UiNodeSpec = {
  ...row([
    { component: "Badge", props: { variant: "soft", color: "amber", highContrast: true, value: "Decisions are disabled" } },
    text("A protected call runs with nobody deciding while the gate is off.", { size: "2", color: "gray" }),
  ]),
  visible: { source: { state: "/mantis/state/approvalsOn" }, equals: false },
}
