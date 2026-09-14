/**
 * The transcript of the session on screen.
 *
 * The app calls this read "history"; the page names it what it shows, and it is a
 * section like every other list here — a titled card that says what it holds —
 * rather than a bare heading with a line of instruction under it.
 *
 * Nothing here states loading or failure, and that is deliberate: this card is
 * drawn inside the room, and the room is drawn only once the read has answered.
 * So "no first row" here means this session has no turns, never that a read is
 * still in flight, and the failure is stated above the room where its retry is.
 * A card that repeated either would be one read reported twice, with one of the
 * two reports wrong.
 *
 * `at` is the turn's own timestamp and the key the repeat is counted by. The
 * transcript's order is the deck's, not this page's: a list re-sorted here would
 * disagree with the terminal an operator may be reading at the same time.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { emptyMessage, line, row, section, stateBadge } from "./effect-ui-nodes.ts"

/** One turn: who said it, then what was said. */
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
