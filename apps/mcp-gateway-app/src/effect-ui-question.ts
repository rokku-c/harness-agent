/**
 * The start screen: the question this app exists to answer.
 *
 * It leads with the question rather than with the topology because the loop is a
 * question and not a workflow, and the two ways an operator arrives here are the
 * two ways a question arrives — they thought of it, or a colleague sent them the
 * denial. The doors to the three reads stand beside it rather than in a second
 * screen, because reading the topology is what an operator does *about* an
 * answer and never instead of asking for one.
 *
 * The choice is written to view state and not to `/_nav`, which is where an
 * entered screen's parameters live. `useNavState` writes `/_nav` whole on every
 * arrival, so a choice kept there would be gone the moment the operator pressed
 * Back from the answer to change the tool — and that is the loop's commonest
 * move.
 *
 * The two lists are the directory and the catalog the door itself reads, so an
 * option offered here is an option the engine can be asked about. A name typed
 * from memory into a select is not possible, which is the point: the gateway
 * answers about the names it advertises, and a plausible-looking one it does not
 * would come back as a refusal about nothing.
 */
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

/**
 * One option: what the item *is* goes on `value`, and the same string again is
 * the label, because a `Select.Item`'s value is part of its own contract and
 * cannot double as the content a plain binding would make of it. A tool needs no
 * second line under its name — the advertised name already carries its server.
 */
const option = (field: string): UiNodeSpec =>
  ({ component: "Select.Item", item: field, as: "value", children: [{ component: "Text", item: field }] })

/** `key` is the field of the record the option's value is read from, not the label's builder. */
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
