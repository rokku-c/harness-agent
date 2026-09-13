/**
 * The workspace: the declared resources and the records they hold, plus the
 * writes an operator can make against them. The append form sits above the list
 * because it does not depend on it; the form that addresses one record sits
 * below, since the ids it takes are read off the rows.
 */

import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { sharedSourceStates } from "./effect-ui-list.ts"
import { cell, cellOf, codeCell, heading, table, text } from "./effect-ui-nodes.ts"
import { addForm, recordForm } from "./effect-ui-workspace-forms.ts"

/** A record's own field, rendered where the `value` prop lands. */
const bound = (item: string, props: Readonly<Record<string, unknown>> = {}): UiNodeSpec =>
  ({ component: "Text", props, item })

/**
 * One resource: what it holds, then its records as rows. A record's identity is
 * its text — the id is what a write takes, so it is a chip at the end of the
 * row rather than the headline.
 */
const resourceCard: UiNodeSpec = {
  component: "Card",
  props: { variant: "surface" },
  children: [
    { component: "Heading", props: { size: "3" }, item: "label" },
    bound("write/description", { size: "2", color: "gray" }),
    table(["Record", "Source", "Id"],
      [cell("text"), cellOf(bound("source", { size: "1", color: "gray" })), codeCell("id")],
      { source: { item: "records" }, key: "id" }),
    // a table with no rows is a bare header, which reads as broken; a record's
    // own field is the only presence test a repeat item can offer
    { component: "Text", props: { value: "No records yet.", size: "2", color: "gray" },
      visible: { source: { item: "records/0" }, not: true } },
  ],
}

export const workspaceNodes: readonly UiNodeSpec[] = [
  {
    component: "Card",
    children: [
      { component: "Flex", props: { direction: "column", gap: "3" }, children: [
        heading("Workspace", { size: "3" }),
        text("Declared records written by the operator or an agent.", { size: "2", color: "gray" }),
        addForm,
        ...sharedSourceStates("workspace", "/mantis/workspace/resources", "No resources are declared."),
        { component: "Flex", props: { direction: "column", gap: "3" },
          repeat: { source: { state: "/mantis/workspace/resources" }, key: "kind" }, children: [resourceCard] },
        { component: "Separator", props: { size: "4" } },
        text("Change or delete one record by its id.", { size: "2", color: "gray" }),
        recordForm,
      ] },
    ],
  },
]
