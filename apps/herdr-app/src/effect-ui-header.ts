import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { WORKSPACES_SOURCE, heading, row, text } from "./effect-ui-nodes.ts"

const socketPath = `/herdr/${WORKSPACES_SOURCE}/server/socketPath`

export const serverRow: UiNodeSpec = row([
  text("Server", { size: "1", color: "gray" }),
  { component: "Code", props: { size: "1", variant: "soft" }, bind: socketPath,
    visible: { source: { state: socketPath } } },
])

const door = (value: string, action: string, look: "solid" | "soft"): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: look }, onPress: action })

export const consoleHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Terminal agents", { size: "6" }),
      text("The coding agents a running Herdr server has recognized inside a pane, and the state each one is in.", { size: "2", color: "gray" }),
      serverRow,
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Start a terminal agent", "herdr.openStart", "solid"),
      door("Workspaces", "herdr.openWorkspaces", "soft"),
    ] },
  ],
}
