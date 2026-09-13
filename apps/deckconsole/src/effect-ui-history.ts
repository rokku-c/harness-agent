/**
 * The turns of the session an operator opened, as the section they read them in.
 *
 * The app calls this read "history"; the page names it what it shows. It is a
 * section like every other list on the page — a titled card that says what it is
 * waiting for and what it holds — rather than a bare heading with a loose line of
 * instruction floating under it.
 *
 * It renders what the row's press loaded into `/opened`, so the turns on screen
 * always belong to the session the detail beside them names. A read that fails
 * replaces that path with its error, which is why the refusal is shown by the
 * press that issued it (the Sessions card) and not a second time here.
 */

import { row, type UiNodeSpec } from "@effect-agent/effect-ui"
import { line, section, stateBadge, text } from "./effect-ui-nodes.ts"
import { emptyList } from "./effect-ui-states.ts"

/** One turn: who said it, then what was said. */
const turn: UiNodeSpec = {
  component: "Card",
  props: { size: "1", variant: "surface" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "2" }, children: [
      // the turn's own line is meant to fill the card, so the stack keeps stretching
      // and the role, sized to its content, takes the row
      row([stateBadge("role")]),
      line("content"),
    ] },
  ],
}

export const historyNodes: readonly UiNodeSpec[] = [
  section("Transcript", [
    // nothing opened: the section says what would fill it, so an operator never
    // reads an empty card as a broken one
    { ...text("Open a session row to read its transcript.", { size: "2", color: "gray" }),
      visible: { source: { state: "/opened/sessionId" }, not: true } },
    { component: "Flex", props: { direction: "column", gap: "2" },
      repeat: { source: { state: "/opened/turns" }, key: "at" }, children: [turn] },
    emptyList("/opened/ok", "/opened/turns", "This session has no turns yet."),
  ]),
]
