import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { press, row } from "./effect-ui-nodes.ts"
import { sourceStatusPath } from "./effect-ui-nodes.ts"

export const retry = (action: string): UiNodeSpec =>
  press("Try again", action, undefined, { size: "1", variant: "soft" })

export const refused = (sentence: string, bind: string, again: UiNodeSpec): UiNodeSpec => ({
  component: "Callout.Root",
  props: { color: "red", highContrast: true, size: "1" },
  visible: { source: { state: bind } },
  children: [
    { component: "Flex", props: { direction: "column", gap: "2" }, children: [
      { component: "Callout.Text", props: { value: sentence } },
      { component: "Code", props: { size: "1", variant: "soft" }, bind },
      row([again]),
    ] },
  ],
})

export const readFailure = (id: string, sentence: string, again: UiNodeSpec): UiNodeSpec =>
  refused(sentence, `${sourceStatusPath(id)}/error`, again)
