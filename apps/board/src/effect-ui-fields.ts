import { failureCallout, type UiNodeSpec } from "@effect-agent/effect-ui"
import { stateOptions } from "./effect-ui-states.ts"

export const labelled = (label: string, control: UiNodeSpec): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "1" },
  children: [
    { component: "Text", props: { value: label, size: "1", weight: "medium" } },
    control,
  ],
})

export const entry = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextField.Root", bind })
export const memo = (label: string, bind: string): UiNodeSpec => labelled(label, { component: "TextArea", bind })

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

export const refusal = (bind: string): UiNodeSpec => {
  const callout = failureCallout(bind)
  return { ...callout, props: { ...callout.props, highContrast: true } }
}
