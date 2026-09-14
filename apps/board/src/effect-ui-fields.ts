/**
 * The controls both editable records are built from.
 *
 * A field's name sits above its control and never beside it, and the name is the
 * label role rather than body text: at 12 px medium it is read as the name of the
 * control under it, where a body-size grey line reads as a sentence about it.
 * That is also why this is not the package's own `field` builder, which sets the
 * name in the body register.
 *
 * The state picker offers the same five states the columns wall draws and the
 * filter chips name, read from one list: a picker offering a state no column has
 * is how a task becomes invisible on the board that holds it.
 *
 * `refusal` is the package's failure callout with the fill the design system
 * requires of every tone surface — step 11 text over a step 3 ground is the one
 * combination that fails contrast in the light appearance, and `highContrast` is
 * the system's own switch to step 12 rather than a hand-written colour.
 */

import { failureCallout, type UiNodeSpec } from "@effect-agent/effect-ui"
import { stateOptions } from "./effect-ui-states.ts"

/** The name above the control. */
const labelled = (label: string, control: UiNodeSpec): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    { component: "Text", props: { value: label, size: "1", weight: "medium" } },
    control,
  ],
})

export const entry = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextField.Root", bind })
export const memo = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextArea", bind })

/** One control for five states; a `Select.Item`'s label is a child, since `value` is its own value. */
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

/** A refused write, said where the values it refused are still on screen. */
export const refusal = (bind: string): UiNodeSpec => {
  const callout = failureCallout(bind)
  return { ...callout, props: { ...callout.props, highContrast: true } }
}
