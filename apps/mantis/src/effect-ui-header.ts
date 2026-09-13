/**
 * Mantis's header: what the console is, and the doors to the three things the
 * first screen is not already showing.
 *
 * The first screen is what needs an operator: the approvals holding an agent up,
 * and the conversations this console has held. A conversation's own room, the
 * form that names one this console has not held, the workspace and the event log
 * are destinations — entered and come back from rather than scrolled to, past a
 * history that grows without limit (Journey 3, `docs/flows.md`).
 *
 * The doors sit above the scrolling region because the region scrolls and they
 * must not scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: "soft" }, onPress: action })

export const mantisHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Mantis", { size: "6" }),
      text("Human-agent conversations, approvals, and workspace records.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Workspace", "mantis.openWorkspace"),
      door("Events", "mantis.openEvents"),
      door("New conversation", "mantis.newConversation"),
    ] },
  ],
}
