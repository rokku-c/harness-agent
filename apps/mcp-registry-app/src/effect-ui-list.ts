/**
 * The start screen: the registry, and the two doors to the acts that are about
 * no server in particular.
 *
 * The list leads because it is what an operator comes back to read, and it is
 * the only thing that grows, so it is the only thing in a region: the heading,
 * the doors and the line saying the read failed keep their place while a
 * registry of any length scrolls under them. Withdrawing one is not a door here
 * — it belongs to the row that already names the server it is about.
 *
 * The heading names the screen and not the app: the chrome's own bar carries the
 * app's title, so a second identical line would spend a row at density 7 to say
 * nothing. This is the `Heading` a route change moves focus to (§12).
 *
 * The empty notice names the door above it rather than carrying a press of its
 * own, because that door is on this screen and is the route by which the list
 * fills — the one thing §9 asks an empty state to say.
 */
import { heading, press, region, row, text, type UiActionSpec, type UiNodeSpec } from "@effect-agent/effect-ui"
import { registryRead } from "./effect-ui-registry-source.ts"
import { serversTable } from "./effect-ui-servers.ts"

const doors: UiNodeSpec = row([
  press("Register a server", "registry.openRegister", undefined, { variant: "solid", size: "2" }),
  press("Preview a resource", "registry.openPreview", undefined, { variant: "soft", size: "2" }),
])

const start: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    heading("Servers", { size: "4" }),
    text("One row per registered MCP server, with its version, era, status and the ui:// resources it declares.", { size: "2", color: "gray" }),
    doors,
  ],
}

export const serversScreen: readonly UiNodeSpec[] = [start, registryRead, region([serversTable])]

/** The doors above are destinations, so each one names a screen and nothing else. */
export const navigation: readonly UiActionSpec[] = [
  { name: "registry.openRegister", opens: "register" },
  { name: "registry.openWithdraw", opens: "withdraw" },
  { name: "registry.openPreview", opens: "preview" },
]
