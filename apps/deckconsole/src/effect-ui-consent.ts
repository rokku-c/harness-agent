/**
 * The asks waiting on an operator. A tool call does not run until one of these
 * is decided, so the decision is the page's most consequential press and every
 * row carries it — the row's own, not a second copy of it over the table.
 */

import { row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, code, press, refused, section, table, text } from "./effect-ui-nodes.ts"
import { sharedStates } from "./effect-ui-states.ts"

/**
 * The tool is what the row is about; the session is the key it belongs to. Allow
 * is the decision an operator usually wants, and deny is its destructive half —
 * one press each, ranked rather than repeated across the section.
 */
const decisionCells: readonly UiNodeSpec[] = [
  cell("tool"),
  cellOf(code("sessionId")),
  cellOf(row([
    press("Allow", "deck.allow", { callId: { item: "callId" }, allow: true }, { size: "1", color: "green" }),
    press("Deny", "deck.deny", { callId: { item: "callId" }, allow: false }, { size: "1", variant: "soft", color: "red" }),
  ])),
]

export const consentNodes: readonly UiNodeSpec[] = [
  section("Pending consent", [
    text("Nothing an agent asks for runs until it is decided here.", { size: "2", color: "gray" }),
    ...sharedStates("deck", "/deck/pending", "No consent requests are waiting."),
    table(["Tool", "Session", "Decision"], decisionCells, { source: { state: "/deck/pending" }, key: "callId" }),
    row([refused("/result/consent/error")]),
  ]),
]
