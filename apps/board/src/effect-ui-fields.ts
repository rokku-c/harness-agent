/**
 * The shapes both editable records are built from — a labelled control, the
 * state picker, the refusal under a write, and the row an outcome lands in.
 *
 * A write's failure lands in the card that issued it, on that card's own result
 * path, so the builders take the path rather than reaching for one.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { stateOptions } from "./effect-ui-board.ts"

/** A field's name above the control the design system renders for it. */
const labelled = (label: string, control: UiNodeSpec): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    { component: "Text", props: { value: label, size: "2", weight: "medium" } },
    control,
  ],
})

export const entry = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextField.Root", bind })
export const memo = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextArea", bind })

/** One control for five states; a `Select.Item`'s label is a child, since `value` is its value. */
export const picker = (bind: string): UiNodeSpec => labelled("State", {
  component: "Select.Root",
  bind,
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a state" } },
    { component: "Select.Content", children: stateOptions.map((option): UiNodeSpec => ({
      component: "Select.Item",
      props: { value: option.value },
      children: [{ component: "Text", props: { value: option.label } }],
    })) },
  ],
})

/** What a refused call said. Absent until there is one, so it is never an empty box. */
export const refusal = (path: string): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", size: "1" },
  visible: { source: { state: `${path}/error` } },
  children: [{ component: "Callout.Text", bind: `${path}/error` }],
})

/**
 * The presses, and beside them the mark the write's own answer carries: a
 * created or saved task has an `id`, a deleted one answers `ok`. Neither is a
 * field a successful read of the same path would happen to have.
 *
 * The marks sit in a row with the presses rather than under them: the card's
 * stack is a column, and a column stretches whatever it holds, so either a lone
 * "Created" badge or a lone button would paint as a bar across the card. A row
 * whose marks are all hidden has nothing in it and takes no height, which is
 * what an outcome that has not happened yet should look like.
 */
export const withOutcome = (presses: readonly UiNodeSpec[], path: string, marks: readonly (readonly [string, string])[]): UiNodeSpec => ({
  component: "Flex",
  props: { gap: "3", wrap: "wrap", align: "center" },
  children: [
    ...presses,
    ...marks.map(([state, label]): UiNodeSpec => ({
      component: "Badge",
      props: { color: "green", variant: "soft", value: label },
      visible: { source: { state } },
    })),
  ],
})
