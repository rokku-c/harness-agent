/**
 * The registry's header: what the console is, and the doors to the two acts the
 * server list is not already showing.
 *
 * The list is the first screen because it is what an operator comes back to
 * read, and the two acts are destinations: on a phone a section is somewhere an
 * operator scrolls to, past a registry that grows with every server that
 * announces itself. The third act, withdrawing one, is the row's own — the row
 * already stands on the server it names, so its door belongs there rather than
 * in a bar of doors about nothing in particular.
 *
 * The doors sit above the scrolling region because the region scrolls and they
 * must not scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "@effect-agent/effect-ui"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: "soft" }, onPress: action })

export const registryHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("MCP Registry", { size: "6" }),
      text("MCP servers, transport, leases, health, and ui:// previews.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Register a server", "registry.openRegister"),
      door("Preview a resource", "registry.openPreview"),
    ] },
  ],
}
