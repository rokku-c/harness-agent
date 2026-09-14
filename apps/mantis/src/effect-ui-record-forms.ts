/**
 * The two writes an operator makes against the record store.
 *
 * The kind is picked from the kinds the store declares rather than typed. A
 * typed kind that no declared resource answers for is refused by the tool with a
 * sentence about the store's own vocabulary, and an operator who has to read that
 * sentence has already been told what the picker would have shown them.
 *
 * The form that addresses one record by its id is one form for both writes, and
 * its two presses share the id they address: an update and a delete are the two
 * things an operator does to a record they have identified, and a delete button
 * inside every row's cell is a destructive press one mis-click away from a row
 * an operator was only reading.
 *
 * The delete's own refusal is read from `ok` and not from the presence of a
 * sentence, because this route answers a *successful* delete with a sentence too
 * — `deleted <id>` — and a readout that showed any sentence it found would paint
 * that one as a red failure.
 */

import { toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"
import { failedBadge, outcome, refusedBadge, refusedWriteBadge } from "./effect-ui-feedback.ts"
import { field, press, row } from "./effect-ui-nodes.ts"

/** An item's own label is a child: the item's `value` is its value, not its text. */
const kindItem: UiNodeSpec = { component: "Select.Item", item: "kind", children: [{ component: "Text", item: "label" }] }

const kindPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/recordAdd/kind",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a kind" } },
    { component: "Select.Content", repeat: { source: { state: "/mantis/records/resources" }, key: "kind" }, children: [kindItem] },
  ],
}

export const addForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Kind", kindPicker),
    field("Text", { component: "TextArea", bind: "/recordAdd/text" }),
    row([press("Add record", "mantis.recordAdd", { kind: { state: "/recordAdd/kind" }, text: { state: "/recordAdd/text" } })]),
    row([...outcome("/mantis/recordAdd", "/mantis/recordAdd/ok", "Record added")]),
  ],
}

export const recordForm: UiNodeSpec = {
  component: "Flex",
  props: { direction: "column", gap: "3" },
  children: [
    field("Record id", { component: "TextField.Root", bind: "/recordEdit/recordId" }),
    field("Replacement text", { component: "TextField.Root", bind: "/recordEdit/text" }),
    row([
      press("Update record", "mantis.recordUpdate", { recordId: { state: "/recordEdit/recordId" }, text: { state: "/recordEdit/text" } }),
      press("Delete record", "mantis.recordDelete", { recordId: { state: "/recordEdit/recordId" } }, { variant: "soft", color: "red" }),
    ]),
    row([...outcome("/mantis/recordUpdate", "/mantis/recordUpdate/ok", "Record updated")]),
    row([
      { ...toneBadge("ok", "Record deleted"), visible: { source: { state: "/mantis/recordDelete/ok" }, equals: true } },
      refusedWriteBadge("/mantis/recordDelete"),
      failedBadge("/mantis/recordDelete"),
    ]),
  ],
}
