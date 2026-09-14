import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, line, row, section, stateBadge } from "./effect-ui-nodes.ts"

const turn: UiNodeSpec = {
  component: "Card", props: { size: "1", variant: "surface" },
  children: [{ component: "Flex", props: { direction: "column", gap: "2" }, children: [
    row([stateBadge("role")]),
    line("content"),
  ] }],
}

export const transcript: UiNodeSpec = section("Transcript", [
  { component: "Flex", props: { direction: "column", gap: "2" },
    repeat: { source: { state: "/opened/turns" }, key: "at" }, children: [turn] },
  emptyMessage("/opened/turns", "This session has no turns yet. Send turn adds the first one."),
])
