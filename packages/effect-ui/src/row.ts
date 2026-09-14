import type { UiNodeSpec } from "./spec.ts"

export const row = (children: readonly UiNodeSpec[]): UiNodeSpec => ({
  component: "Flex",
  props: { gap: "2", wrap: "wrap", align: "center" },
  children: [...children],
})
