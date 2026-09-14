import type { UiNodeSpec } from "@effect-agent/effect-ui"
import type { HerdrAction } from "./effect-ui-actions.ts"
import { refused } from "./effect-ui-failures.ts"
import { outcomeError, outcomeOk, row } from "./effect-ui-nodes.ts"

export interface Command {
  readonly label: string
  readonly action: HerdrAction
  readonly variant?: "solid" | "soft"
  readonly sentence: string
  readonly done?: string
}

export const command = ({ label, action, variant = "soft", sentence, done }: Command): UiNodeSpec => {
  const button = (text: string, size: "1" | "2", look: "solid" | "soft"): UiNodeSpec =>
    ({ component: "Button", props: { value: text, size, variant: look }, onPress: action })
  return {
    component: "Flex", props: { direction: "column", gap: "1", align: "start" },
    children: [
      button(label, "2", variant),
      ...(done === undefined ? [] : [row([
        { component: "Badge", props: { variant: "surface", color: "jade", highContrast: true, value: done },
          visible: { source: { state: outcomeOk(action) }, equals: true } },
      ])]),
      refused(sentence, outcomeError(action), button("Try again", "1", "soft")),
    ],
  }
}
