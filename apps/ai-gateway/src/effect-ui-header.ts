/**
 * The gateway's header: what the console is, and the doors to the three lists
 * behind the one it opens on.
 *
 * The providers are the surface's own task — they are what an operator acts on,
 * and the only control on this console is theirs — so they stay on the first
 * screen. The three lists under them are read-only: read, not pressed. Those are
 * destinations, and a destination is entered and come back from rather than
 * scrolled to (Journey 3, `docs/flows.md`). On a phone the alternative is a page
 * whose last list is reachable only by scrolling past everything else.
 *
 * The doors sit above the scrolling region because the region scrolls and they
 * must not scroll away with it — the one thing on this surface that has to stay
 * where it was.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: "soft" }, onPress: action })

export const gatewayHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("AI Gateway", { size: "6" }),
      text("Model proxy: serves OpenAI Chat, OpenAI Responses, and Anthropic Messages traffic from the providers below.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Activity", "gateway.activity"),
      door("Routing rules", "gateway.rules"),
      door("Endpoints", "gateway.endpoints"),
    ] },
  ],
}
