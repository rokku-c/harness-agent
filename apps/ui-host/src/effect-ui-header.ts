/**
 * The canvas console's header: what the surface is, and the doors to the three
 * things the first screen is not already showing.
 *
 * The canvases are the surface's own task — they are what an operator inspects —
 * so they stay on the first screen with the figure that says which one the
 * runtime is showing. The renderer and theme are a control surface of their own,
 * the catalog is a reference, and the activity log is a record: three
 * destinations rather than three more blocks below a list that grows with every
 * canvas (Journey 3, `docs/flows.md`).
 *
 * The doors sit above the scrolling region because the region scrolls and they
 * must not scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "./effect-ui-nodes.ts"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, size: "2", variant: "soft" }, onPress: action })

export const uiHostHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("UI Canvas", { size: "6" }),
      text("Inspect and control the declarative UI runtime.", { size: "2", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Renderer and theme", "uiHost.openRenderer"),
      door("Catalog", "uiHost.openCatalog"),
      door("Activity", "uiHost.openActivity"),
    ] },
  ],
}
