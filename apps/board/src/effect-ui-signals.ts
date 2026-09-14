/**
 * The second line of a task, wherever a task is drawn.
 *
 * A board is read for three things at once — what this waits on, who is on it,
 * and why it stopped — so those facts sit on the record rather than behind it: a
 * board you open row by row is a list of titles. The worktable's row and the
 * columns wall's card both carry this one line, which is what keeps the two
 * shapes from reporting the same task differently.
 *
 * Every signal is guarded by the field it shows and not by a flag of its own, so
 * an absent parent, an empty waits list and a task that never stopped are one
 * case to a reader and leave no gap: the line is a `row`, and a row whose
 * children are all hidden takes no height.
 */

import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

/** The row carries this field at all. */
const has = (field: string): UiNodeSpec["visible"] => ({ source: { item: field } })

/** A label and the value it introduces. */
const labelled = (label: string, field: string, value: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "1", align: "center" }, visible: has(field),
    children: [{ component: "Text", props: { value: label, size: "1", color: "gray" } }, value] })

/** The same, where the tone's badge says the word a label would have said. */
const toned = (field: string, badge: UiNodeSpec, value: UiNodeSpec): UiNodeSpec =>
  ({ component: "Flex", props: { gap: "2", align: "center" }, visible: has(field), children: [badge, value] })

export const taskSignals: UiNodeSpec = row([
  labelled("in", "parentTitle", { component: "Text", props: { size: "1" }, item: "parentTitle" }),
  // What this row is blocked on is a pending step, and the titles it names are
  // the server's own list rather than a count this view would have to make up.
  toned("waits", { ...toneBadge("pending", "Waiting"), visible: has("waits") }, { component: "Text", props: { size: "1" }, item: "waits" }),
  // A reason is a value the server wrote, so it is set in mono like every other
  // one, and it is stated on the row rather than saved for a tooltip.
  toned("failure", { ...toneBadge("failed", "Failed"), visible: has("failure") }, { component: "Code", props: { size: "1" }, item: "failure" }),
])
