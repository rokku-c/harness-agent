import type { UiNodeSpec } from "./spec.ts"

export const region = (children: readonly UiNodeSpec[]): UiNodeSpec =>
  ({ component: "Box", props: { flexGrow: "1", flexBasis: "0", minHeight: "0", overflow: "auto" },
    children: [{ component: "Flex", props: { direction: "column", gap: "4" }, children }] })
