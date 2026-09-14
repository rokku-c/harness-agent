/**
 * The theme every canvas on this host is drawn in.
 *
 * The picker is a draft and the readout is what the runtime is actually on, so
 * the two are labelled differently: two lines both called "Theme", over a picker
 * and a live value, is how an operator comes to distrust both.
 *
 * The draft is committed by a press rather than applied as it changes, because
 * the theme is host state and not this screen's: it is what every canvas in the
 * host is drawn in, and the line above the picker says so before the press
 * rather than after it (flows.md §J2's blast-radius rule). The refusal is
 * written below the press, which is the control that caused it — a draft that
 * was never sent cannot have been refused. Its `Try again` re-issues that same
 * write: a failure clears no draft, and the retry reads the values where the
 * press read them, so the second press asks the question the first one asked
 * rather than a second one this screen made up.
 *
 * The runtime's read is this screen's too. The readout says nothing until the
 * runtime has answered; a read that failed is stated above it, with the value
 * the last good read carried still below.
 */
import type { UiActionParam, UiNodeSpec } from "@effect-agent/effect-ui"
import { field, loadingRows, press, row, section, text } from "@effect-agent/effect-ui"
import { refused, retry } from "./effect-ui-refusal.ts"
import { readFailed } from "./effect-ui-sources.ts"

/** The identifiers the runtime accepts. The host serves no list of them. */
const themes = ["default", "warm-paper", "dusk"]

/** The draft, and the values the write reads off it — one source for both presses. */
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
