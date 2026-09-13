import type { UiNodeSpec } from "@effect-agent/effect-ui"
import { sourceStates } from "@effect-agent/effect-ui"
import { failureCallout, field, liveValue, row, section } from "./effect-ui-nodes.ts"

const button = (value: string, onPress: string, params: UiNodeSpec["params"]): UiNodeSpec =>
  ({ component: "Button", props: { value }, onPress, params })

/**
 * The registered renderers are the server's own list, so the picker's options
 * are that list rather than a copy of it: an option written into this file
 * would keep offering a renderer the server no longer has. `item: ""` on the
 * item is the renderer id itself, which is both its value and its label.
 */
const rendererPicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/commands/renderer",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a renderer" } },
    { component: "Select.Content", repeat: { source: { state: "/renderers" } }, children: [
      { component: "Select.Item", item: "", children: [{ component: "Text", item: "" }] },
    ] },
  ],
}

/** The server serves no theme list, so the identifiers the runtime accepts live here. */
const themePicker: UiNodeSpec = {
  component: "Select.Root",
  bind: "/commands/theme",
  children: [
    { component: "Select.Trigger", props: { placeholder: "Select a theme" } },
    { component: "Select.Content", children: ["default", "warm-paper", "dusk"].map((theme): UiNodeSpec => ({
      component: "Select.Item", props: { value: theme }, children: [{ component: "Text", props: { value: theme } }],
    })) },
  ],
}

/**
 * The renderer and the theme the runtime draws with. Each is a picker for the
 * choice that is not applied yet, a line naming the value the runtime is on
 * now, and the press that commits the choice. The two lines say which figure
 * they carry — a picker is a draft, and two lines both called "In use" over two
 * different settings is how an operator comes to distrust both.
 *
 * The two presses keep one result path each. A shared path would report the
 * renderer's failure under a theme press made after it, and a failure belongs
 * where the press was.
 */
export const commandCard: UiNodeSpec = section("Renderer and theme", [
  ...sourceStates("renderers", "No renderers are registered."),
  field("Renderer", rendererPicker),
  liveValue("Renderer in use", "/runtime/renderer"),
  row([button("Set renderer", "uiHost.setRenderer", { kind: "set-renderer", renderer: { state: "/commands/renderer" } })]),
  failureCallout("/commands/results/renderer/error"),
  field("Theme", themePicker),
  liveValue("Theme in use", "/runtime/theme"),
  row([button("Set theme", "uiHost.setTheme", { kind: "set-theme", theme: { state: "/commands/theme" } })]),
  failureCallout("/commands/results/theme/error"),
])
