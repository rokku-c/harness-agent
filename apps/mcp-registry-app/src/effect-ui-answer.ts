import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

export const answer = (done: string, named: string): UiNodeSpec =>
  ({ ...row([toneBadge("ok", done), { component: "Code", bind: named }]),
    visible: { source: { state: named } } })
