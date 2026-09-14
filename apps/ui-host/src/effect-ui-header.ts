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
