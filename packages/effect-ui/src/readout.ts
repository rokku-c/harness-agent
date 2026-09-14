import type { UiNodeSpec } from "./spec.ts"

export const failureCallout = (bind: string): UiNodeSpec =>
  ({ component: "Callout.Root", props: { color: "red", highContrast: true, size: "1" },
    visible: { source: { state: bind } }, children: [{ component: "Callout.Text", bind }] })

export const failureBadge = (bind: string): UiNodeSpec =>
  ({ component: "Badge", props: { variant: "soft", color: "red", highContrast: true },
    bind, visible: { source: { state: bind } } })
