/**
 * The agentd header: what the center is, and the doors to the two things the
 * first screen is not already showing.
 *
 * The doors sit here, above the scrolling region, because the fleet below them
 * has no limit — three inventories of it, each as long as the fleet is — and a
 * door that scrolls away with them is a door an operator has to hunt for on a
 * phone.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: "soft" }, onPress: action })

export const agentdHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Agentd", { size: "6" }),
      text("Machine and agent configuration center: what each is bound to run.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Launches", "agentd.openLaunches"),
      door("MCP registry", "agentd.openRegistry"),
    ] },
  ],
}
