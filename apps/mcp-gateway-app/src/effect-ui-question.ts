import { emptyRows, field, heading, press, region, row, section, text, type UiNodeSpec } from "@effect-agent/effect-ui"
import { AGENT, IDENTITIES, PRINCIPALS, TOOL, TOOLS } from "./effect-ui-paths.ts"

const head: UiNodeSpec = {
  component: "Flex", props: { direction: "column", gap: "3" },
  children: [
    heading("Ask about access", { size: "4" }),
    text("Whether one principal reaches one tool, answered by the same engine the door calls.", { size: "2", color: "gray" }),
    row([
      press("Principals", "gateway.openPrincipals", undefined, { variant: "soft", size: "2" }),
      press("Topology", "gateway.openTopology", undefined, { variant: "soft", size: "2" }),
      press("Audit", "gateway.openAudit", undefined, { variant: "soft", size: "2" }),
    ]),
  ],
}

const option = (field: string): UiNodeSpec =>
  ({ component: "Select.Item", item: field, as: "value", children: [{ component: "Text", item: field }] })

const chooser = (name: string, path: string, placeholder: string, list: string, key: string): UiNodeSpec =>
  field(name, {
    component: "Select.Root",
    bind: path,
    children: [
      { component: "Select.Trigger", props: { placeholder } },
      { component: "Select.Content", children: [{ component: "Select.Group", repeat: { source: { state: list } }, children: [option(key)] }] },
    ],
  })

const form: UiNodeSpec = section("The question", [
  chooser("Principal", AGENT, "Select a principal", PRINCIPALS, "key"),
  emptyRows(IDENTITIES, PRINCIPALS, "No principal is in the directory. Open Principals and issue a token for one to add it."),
  chooser("Tool", TOOL, "Select a tool", TOOLS, "advertised"),
  text("A tool left unchosen asks whether this principal is bound to any live set at all.", { size: "1", color: "gray" }),
  row([press("Preview", "gateway.openAccess", undefined, { variant: "solid", size: "2" })]),
])

export const questionScreen: readonly UiNodeSpec[] = [head, region([form])]
