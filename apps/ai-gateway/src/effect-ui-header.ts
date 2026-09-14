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
