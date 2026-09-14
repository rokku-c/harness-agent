/**
 * The one header this app draws, and the doors the start screen needs.
 *
 * A screen title inside an app is a section title and never the display size:
 * the display role belongs to Home alone, so an app opening at the display size
 * would be claiming to be the console's front page (design-system §2).
 *
 * The doors stand outside the scrolling region below them, and that placement is
 * the point rather than the layout: the region scrolls, so a history that grows
 * without limit would otherwise carry the app's destinations off the top of the
 * screen with it. They are presses because they are destinations, and only the
 * start screen is handed them — a screen an operator entered already has the
 * shell's own back control naming where it returns to, and a second copy of the
 * three destinations under it is a second navigation graph to keep in step with
 * the first.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, press, row, text } from "./effect-ui-nodes.ts"

export const mantisHeader: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    heading("Mantis", { size: "4" }),
    text("Human-agent conversations, the decisions holding a call up, and the records this host holds.", { size: "2", color: "gray" }),
  ],
}

/**
 * The start screen's three destinations, in a row so each keeps the size it was
 * given: a column stretches what it holds, and three stretched presses read as
 * three banners rather than as a menu. New conversation carries the accent,
 * because starting one is the act the rest of the screen exists to serve.
 */
export const mantisDoors: UiNodeSpec = row([
  press("New conversation", "mantis.newConversation", undefined, { variant: "solid", size: "2" }),
  press("Records", "mantis.openRecords", undefined, { variant: "soft", size: "2" }),
  press("Events", "mantis.openEvents", undefined, { variant: "soft", size: "2" }),
])
