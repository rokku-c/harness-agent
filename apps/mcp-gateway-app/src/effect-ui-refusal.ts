import { failureNotice, press, sourceStatusPath, text, type UiNodeSpec } from "@effect-agent/effect-ui"

export const retry = (action: string, label = "Try again"): UiNodeSpec =>
  press(label, action, undefined, { size: "1", variant: "soft" })

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

export const readFailed = (sentence: string, id: string, action: string): UiNodeSpec => ({
  component: "Flex",
  props: { direction: "column", gap: "2" },
  visible: { source: { state: `${sourceStatusPath(id)}/state` }, equals: "failed" },
  children: [text(sentence, { size: "2" }), failureNotice(id), retry(action)],
})
