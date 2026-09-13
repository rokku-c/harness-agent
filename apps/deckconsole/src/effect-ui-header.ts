/**
 * The deck control room's header: what the console is, and the doors to the two
 * jobs the first screen is not already showing.
 *
 * A row's Open is what enters a session, so it belongs to the row and not here.
 * What is left is the deck's other work — opening a session, and the launchers
 * and presets it can open one as — and those are destinations rather than
 * sections: on a phone a section is somewhere an operator scrolls to, and the
 * sessions above it are as long as the deck is busy.
 *
 * The doors sit above the scrolling region because the region scrolls and they
 * must not scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"

const door = (value: string, action: string, variant: string): UiNodeSpec =>
  ({ component: "Button", props: { value, variant }, onPress: action })

export const deckHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Deck control room", { size: "6" }),
      text("Open agent sessions, send turns, read a transcript, and decide what an agent may run.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Launchers and presets", "deck.catalog", "soft"),
      door("Open session", "deck.new", "solid"),
    ] },
  ],
}
