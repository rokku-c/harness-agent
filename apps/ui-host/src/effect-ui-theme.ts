import type { UiActionParam, UiNodeSpec } from "@effect-agent/effect-ui"
import { field, loadingRows, press, row, section, text } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { readFailed } from "./effect-ui-sources.ts"

const themes = ["default", "warm-paper", "dusk"]

const THEME = "/commands/theme"
const setTheme: Readonly<Record<string, UiActionParam>> = { kind: "set-theme", theme: { state: THEME } }

const picker: UiNodeSpec = {
  component: "Select.Root",
  bind: THEME,
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a theme" } },
    { component: "Select.Content", children: themes.map((theme): UiNodeSpec => ({
      component: "Select.Item", props: { value: theme }, children: [{ component: "Text", props: { value: theme } }],
    })) },
  ],
}

const inUse: UiNodeSpec = {
  component: "Flex",
  props: { gap: "2", align: "center" },
  visible: { source: { state: "/runtime/theme" } },
  children: [
    text("In use", { size: "1", color: "gray" }),
    { component: "Code", props: { size: "2" }, bind: "/runtime/theme" },
  ],
}

const commit: UiNodeSpec = press("Set theme", "uiHost.setTheme", setTheme)

export const themeNodes: readonly UiNodeSpec[] = [
  section("Theme", [
    text("A theme applies to every canvas this host renders.", { size: "1", color: "gray" }),
    loadingRows("runtime", 1),
    readFailed("runtime", "Could not read the theme in use."),
    field("Theme", picker),
    inUse,
    row([commit]),
    refused("The theme could not be set.", "/commands/results/theme/error", retry("uiHost.setTheme", setTheme)),
  ]),
]
