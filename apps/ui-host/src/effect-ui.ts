import type { EffectUiView } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, region } from "@effect-agent/effect-ui"
import { heading, metric, text } from "./effect-ui-nodes.ts"
import { activitySection } from "./effect-ui-activity.ts"
import { canvasesSection } from "./effect-ui-canvases.ts"
import { catalogSection } from "./effect-ui-catalog.ts"
import { commandCard } from "./effect-ui-command.ts"

/** UI Canvas app view. The standalone web host remains an implementation detail. */
export const effectUiView: EffectUiView = {
  viewId: "ui-host-console",
  title: "UI Canvas",
  state: {
    runtime: { navigation: { current: "", stack: [] }, theme: "", renderer: "" },
    canvases: [],
    renderers: [],
    components: [],
    extensions: [],
    activity: { events: [] },
    commands: { renderer: "web-html", theme: "default", results: {} },
    canvas: { loaded: undefined },
  },
  sources: [
    { id: "runtime", url: "/ui/api/runtime", state: "/runtime", refreshMs: 5000 },
    { id: "canvases", url: "/ui/api/canvases", state: "/canvases", refreshMs: 5000 },
    { id: "renderers", url: "/ui/api/renderers", state: "/renderers" },
    { id: "components", url: "/ui/api/components", state: "/components" },
    { id: "extensions", url: "/ui/api/extensions", state: "/extensions" },
    { id: "activity", url: "/ui/api/activity", state: "/activity", refreshMs: 5000 },
  ],
  actions: [
    { name: "uiHost.setRenderer", method: "POST", url: "/ui/api/command", result: "/commands/results/renderer", refresh: ["runtime"] },
    { name: "uiHost.setTheme", method: "POST", url: "/ui/api/command", result: "/commands/results/theme", refresh: ["runtime"] },
    { name: "uiHost.loadCanvas", method: "GET", url: "/ui/api/canvas", result: "/canvas/loaded" },
  ],
  nodes: [
    heading("UI Canvas", { size: "6" }),
    text("Inspect and control the declarative UI runtime.", { color: "gray" }),
    // the one figure that is nowhere else on the page: the runtime's own
    // renderer and theme are not repeated here, they sit at the controls that
    // change them. Guarded, because the figure is empty until the runtime has
    // answered and an unguarded card is a blank chip on a fresh page.
    { ...metric("Canvas in view", "/runtime/navigation/current"),
      visible: { source: { state: "/runtime/navigation/current" } } },
    // an empty runtime answer is the normal case, not a verdict, so this
    // source reports only the two states that are true: reading, and failed
    loadingRows("runtime", 1),
    failureNotice("runtime"),
    // The canvases, the control that renders them, and the catalog that lists
    // them are one surface: any of the three can outgrow the screen, so they
    // scroll together under the figure that says what the runtime is showing.
    region([canvasesSection, commandCard, activitySection, catalogSection]),
  ],
}
