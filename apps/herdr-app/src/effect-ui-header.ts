/**
 * The header: what this console is looking at, and the two doors off the fleet.
 *
 * The doors sit above the region rather than inside it, because the fleet has no
 * limit — it is as long as the server has agents — and a door that scrolls away
 * with the rows is a door an operator has to hunt for.
 *
 * The server is named in mono, and it is not decoration. Herdr addresses a server
 * by a unix socket and one machine can have several running, so "which server is
 * this page describing" has to be answerable before a single row is read — a
 * console that answered it wrongly would be describing someone else's agents. It
 * comes from the same read the workspaces list draws on, so it cannot name a
 * different server than the rows under it; and it is on the two screens that ask
 * the server to do something, where being wrong about which one is expensive.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { WORKSPACES_SOURCE, heading, row, text } from "./effect-ui-nodes.ts"

const socketPath = `/herdr/${WORKSPACES_SOURCE}/server/socketPath`

/** Which Herdr server answered, once one has. */
export const serverRow: UiNodeSpec = row([
  text("Server", { size: "1", color: "gray" }),
  { component: "Code", props: { size: "1", variant: "soft" }, bind: socketPath,
    visible: { source: { state: socketPath } } },
])

/** A door between screens: the fleet is the first screen, and these are the two jobs off it. */
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
