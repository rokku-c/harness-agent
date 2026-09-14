import { press, type UiActionParam, type UiNodeSpec } from "@effect-agent/effect-ui"

export const retry = (action: string, params?: Readonly<Record<string, UiActionParam>>): UiNodeSpec =>
  press("Try again", action, params, { size: "1", variant: "soft" })

export const refused = (sentence: string, bind: string, again: UiNodeSpec): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", highContrast: true, size: "1" },
  visible: { source: { state: bind } },
  children: [{
    component: "Flex",
    props: { direction: "column", gap: "2" },
    children: [{ component: "Callout.Text", props: { value: sentence } }, { component: "Code", bind }, again],
  }],
})
