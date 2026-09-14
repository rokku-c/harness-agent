import { row, toneBadge, type UiNodeSpec } from "@effect-agent/effect-ui"

export const outcome = (presses: readonly UiNodeSpec[], marks: readonly (readonly [string, string])[]): UiNodeSpec =>
  row([
    ...presses,
    ...marks.map(([path, word]): UiNodeSpec =>
      ({ ...toneBadge("ok", word), visible: { source: { state: path } } })),
  ])
