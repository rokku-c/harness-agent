/**
 * What the first screen is, and the doors to the three things it is not.
 *
 * The canvases are the screen's own task, so they stay on it; one canvas's
 * document, the theme the host draws with, the catalog of what a canvas can be
 * built from and the record of what the agents announced are destinations,
 * entered and come back from. A list that grows with every canvas the host
 * declares would otherwise push all three off the page.
 *
 * The heading is a section title (size 4) and not the display size: display is
 * the console's Home screen and only there (design-system §2 rule 1). The doors
 * sit above the scrolling region because the region scrolls and they must not
 * scroll away with it.
 */
import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { heading, text } from "@effect-agent/effect-ui"

const door = (value: string, action: string): UiNodeSpec =>
  ({ component: "Button", props: { value, variant: "soft" }, onPress: action })

export const uiHostHeader: UiNodeSpec = {
  component: "Flex",
  props: { justify: "between", align: "baseline", gap: "4", wrap: "wrap" },
  children: [
    { component: "Flex", props: { direction: "column", gap: "1" }, children: [
      heading("Canvases", { size: "4" }),
      text("What this host renders, and at which version.", { size: "1", color: "gray" }),
    ] },
    { component: "Flex", props: { align: "center", gap: "3", wrap: "wrap" }, children: [
      door("Theme", "uiHost.openTheme"),
      door("Catalog", "uiHost.openCatalog"),
      door("Announcements", "uiHost.openAnnouncements"),
    ] },
  ],
}
