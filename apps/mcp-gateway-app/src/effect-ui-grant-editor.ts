import { heading, press, region, row, section, text, whenRows, type UiNodeSpec } from "@effect-agent/effect-ui"
import { NAV_AGENT, NAV_ENTRY, NAV_LIST, NAV_SERVER, NAV_SET } from "./effect-ui-paths.ts"

const named = (label: string, path: string): UiNodeSpec =>
  whenRows({ source: { state: path } }, row([
    text(label, { size: "1", color: "gray" }),
    { component: "Code", bind: path },
  ]))

const object: UiNodeSpec = section("The edit the address names", [
  named("Principal", NAV_AGENT),
  named("Set", NAV_SET),
  named("List", NAV_LIST),
  named("Entry", NAV_ENTRY),
  named("Server", NAV_SERVER),
  { ...text("No set is named, so the refusal is about the binding itself: a binding names a principal and the sets it reaches, and nothing in it consults a tool.", { size: "2", color: "gray" }),
    visible: { source: { state: NAV_SET }, not: true } },
])

const head: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "3" },
  children: [
    heading("Grant editor", { size: "4" }),
    text("The one edit that would change a denial, on the principal and the tool it named. Every value here came through the address, so a colleague's link renders this screen as surely as a press from the denial does.", { size: "2", color: "gray" }),
  ],
}

const declared: UiNodeSpec = section("Where the declaration is made", [
  text("A set and a binding are declared in the center that issues the identity a binding is keyed by, and this console reads them from there. The entry named above is the whole of the change; it is declared there, and this screen is where the result is read.", { size: "2" }),
  row([press("Read the topology", "gateway.openTopology", undefined, { variant: "soft", size: "2" })]),
])

export const grantEditorScreen: readonly UiNodeSpec[] = [head, region([object, declared])]
