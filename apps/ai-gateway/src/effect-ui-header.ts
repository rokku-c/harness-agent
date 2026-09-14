/**
 * What this console is, where it leads, and the one thing it can do.
 *
 * The doors sit above the scrolling region rather than inside it, because the
 * region is what scrolls: a control that scrolls away is a control an operator
 * finds again on every screen. The three lists behind them are read-only, so
 * they are destinations and not sections — a section is somewhere a reader
 * scrolls to, and what stays on this screen is its own task, the providers.
 *
 * The posture line is not a caveat for its own sake. The app declares three
 * reads and a probe and nothing else, so this console cannot change the plane
 * it presents; a surface that looks controllable and is not is exactly the
 * failure that line prevents, and it names where the plane is configured
 * instead of leaving the operator to hunt for it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "@effect-agent/effect-ui"

const door = (title: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value: title, size: "2", variant: "soft" }, onPress: action })

const doors: UiNodeSpec = {
  component: "Flex",
  props: { gap: "2", wrap: "wrap", align: "center", role: "group", "aria-label": "Screens of AI Gateway" },
  children: [
    door("Exchanges", "gateway.exchanges"),
    door("Routing rules", "gateway.rules"),
    door("Upstream endpoints", "gateway.endpoints"),
  ],
}

const posture: UiNodeSpec = {
  component: "Callout.Root", props: { color: "blue", size: "1", highContrast: true },
  children: [{ component: "Callout.Text", props: {
    value: "This console reads the model plane, and its only write is Test. Providers and rules are set in this app's configuration.",
  } }],
}

export const gatewayHeader: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("AI Gateway", { size: "4" }),
      text("Serves OpenAI Chat, OpenAI Responses and Anthropic Messages traffic from the providers below.", { size: "2", color: "gray" }),
    ] },
    doors,
    posture,
  ],
}
