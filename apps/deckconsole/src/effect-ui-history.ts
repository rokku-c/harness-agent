/**
 * The turns of the session an operator opened, as the section they read them in.
 *
 * The app calls this read "history"; the page names it what it shows. It is a
 * section like every other list on the page — a titled card that says what it
 * holds — rather than a bare heading with a loose line of instruction floating
 * under it.
 *
 * It renders what the row's press loaded into `/opened`, so the turns on screen
 * always belong to the session the room names above them. A read that fails
 * replaces that path with its error, and the room states that above: this card
 * is drawn only for a session that was read, so the sentence it has for an empty
 * one can never stand beside a failure.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, row } from "@effect-agent/effect-ui"
import { line, section, stateBadge } from "./effect-ui-nodes.ts"

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
    { component: "Flex", props: { direction: "column", gap: "2" },
      repeat: { source: { state: "/opened/turns" }, key: "at" }, children: [turn] },
    emptyMessage("/opened/turns", "This session has no turns yet."),
  ]),
]
