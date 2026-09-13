/**
 * UI Canvas app view. The standalone web host remains an implementation detail.
 *
 * The first screen is the canvases and the figure that says which one the
 * runtime is showing: that is what an operator comes back to read, and a canvas
 * behind a menu door is one that costs a press to look at. The other three are
 * destinations — the renderer and theme the runtime draws with, the catalog of
 * what it can draw, and the record of what the agents announced — entered and
 * come back from rather than scrolled to (Journey 3, `docs/flows.md`).
 *
 * A press and its answer stay on one screen: a row's Inspect writes the document
 * it read to the same screen the row is on, and the pickers and the presses that
 * commit them are both on the renderer screen, so nothing an operator reads is
 * on a surface they are not looking at.
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { failureNotice, loadingRows, region } from "@effect-agent/effect-ui"
import { activityNodes } from "./effect-ui-activity.ts"
import { canvasesSection } from "./effect-ui-canvases.ts"
import { catalogNodes } from "./effect-ui-catalog.ts"
import { rendererNodes } from "./effect-ui-command.ts"
import { uiHostHeader } from "./effect-ui-header.ts"
import { metric } from "./effect-ui-nodes.ts"

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
    // entering a screen is a behaviour like any other, and there is one way to say what a press does
    { name: "uiHost.openRenderer", opens: "renderer" },
    { name: "uiHost.openCatalog", opens: "catalog" },
    { name: "uiHost.openActivity", opens: "activity" },
    { name: "uiHost.setRenderer", method: "POST", url: "/ui/api/command", result: "/commands/results/renderer", refresh: ["runtime"] },
    { name: "uiHost.setTheme", method: "POST", url: "/ui/api/command", result: "/commands/results/theme", refresh: ["runtime"] },
    { name: "uiHost.loadCanvas", method: "GET", url: "/ui/api/canvas", result: "/canvas/loaded" },
  ],
  nodes: [
    uiHostHeader,
    // the one figure that is nowhere else on the surface: the runtime's own
    // renderer and theme are not repeated here, they sit at the controls that
    // change them. Guarded, because the figure is empty until the runtime has
    // answered and an unguarded card is a blank chip on a fresh page.
    { ...metric("Canvas in view", "/runtime/navigation/current"),
      visible: { source: { state: "/runtime/navigation/current" } } },
    // an empty runtime answer is the normal case, not a verdict, so this
    // source reports only the two states that are true: reading, and failed
    loadingRows("runtime", 1),
    failureNotice("runtime"),
    // The canvases are as long as the runtime's registry, and how long that is
    // is not the surface's business: they scroll in their own box, under a
    // header that holds the doors and stays where it was.
    region([canvasesSection]),
  ],
  screens: [
    { id: "renderer", title: "Renderer and theme", nodes: rendererNodes },
    { id: "catalog", title: "Catalog", nodes: catalogNodes },
    { id: "activity", title: "Activity", nodes: activityNodes },
  ],
}
