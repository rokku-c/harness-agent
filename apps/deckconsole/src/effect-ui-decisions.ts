import type { UiCondition, UiNodeSpec } from "@effect-agent/effect-ui"
import { cell, cellOf, emptyMessage, press, row, section, stateRows, table, text, whenRows } from "./effect-ui-nodes.ts"

const waiting: UiCondition = { source: { item: "decision" }, equals: "pending" }

const VERDICTS = [
  { field: "allow", word: "Allowed", variant: "surface", color: "jade" },
  { field: "deny", word: "Denied", variant: "outline", color: "red" },
  { field: "pending", word: "Waiting", variant: "soft", color: "amber" },
] as const

const verdict: UiNodeSpec = {
  component: "Flex", props: { gap: "2", wrap: "wrap" },
  children: VERDICTS.map((one): UiNodeSpec => ({
    component: "Badge", props: { value: one.word, variant: one.variant, color: one.color, highContrast: true },
    visible: { source: { item: "decision" }, equals: one.field },
  })),
}

export const verdictCell: UiNodeSpec = cellOf(verdict)

export const decisionPresses: UiNodeSpec = cellOf({
  component: "Flex", props: { gap: "2" }, visible: waiting,
  children: [
    press("Allow", "deck.allow", { callId: { item: "callId" }, allow: true }, { size: "1" }),
    press("Deny", "deck.deny", { callId: { item: "callId" }, allow: false }, { size: "1", variant: "soft", color: "red" }),
  ],
})

const answered: UiNodeSpec = cellOf(row([
  { component: "Text", props: { size: "2" }, item: "by" },
  { component: "Text", props: { size: "1", color: "gray" }, item: "decidedAt" },
]))

export const sessionDecisions: UiNodeSpec = section("Decisions for this session", [
  text("Every consent ask this session has raised, newest first. The ones still waiting are answerable here.", { size: "2", color: "gray" }),
  emptyMessage("/opened/consent", "This session has not asked to run anything yet. An ask appears here the moment one is needed."),
  whenRows(stateRows("/opened/consent"), table(["Tool", "Verdict", "Decided by", "Decision"],
    [cell("tool"), verdictCell, answered, decisionPresses],
    { source: { state: "/opened/consent" }, key: "callId" })),
])
