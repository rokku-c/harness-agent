/**
 * UI Canvas: what this host renders, and at which version.
 *
 * The first screen is the canvas list with the one the runtime is showing marked
 * in the row it belongs to. Everything else is a destination entered from there:
 * one canvas's document, the theme every canvas is drawn with, the catalog of
 * what a canvas can be built from, and what the agents using it announced.
 *
 * A canvas is entered rather than expanded in place, because a canvas is an
 * object with an id a colleague can be handed: the row press and a pasted link
 * become one act, and the screen reads the canvas `onEnter` whichever way it
 * arrived (`docs/redesign/flows.md` §7.7).
 *
 * There is one renderer. `renderer` was a config field, a `/renderers` source and
 * a "Set renderer" press that redrew every canvas in the host at once; the host
 * now serves the web renderer directly, so a canvas an agent authored and a
 * screen an app declared cannot disagree about what a component means (§7.7 dead
 * end 1, §A8).
 */
import type { EffectUiView } from "@effect-agent/effect-ui"
import { loadingRows, region } from "@effect-agent/effect-ui"
import { announcementsNodes } from "./effect-ui-announcements.ts"
import { canvasNodes } from "./effect-ui-canvas.ts"
import { canvasesSection } from "./effect-ui-canvases.ts"
import { catalogNodes } from "./effect-ui-catalog.ts"
import { uiHostHeader } from "./effect-ui-header.ts"
import { readFailed, readRetries, uiHostSources } from "./effect-ui-sources.ts"
import { themeNodes } from "./effect-ui-theme.ts"

export const effectUiView: EffectUiView = {
  viewId: "ui-host-console",
  title: "UI Canvas",
  state: {
    runtime: { navigation: { current: "", stack: [] }, theme: "" },
    canvases: [],
    components: [],
    extensions: [],
    activity: { events: [] },
    commands: { theme: "default", results: {} },
    canvas: { loaded: undefined },
  },
  sources: uiHostSources,
  actions: [
    // entering a screen is a behaviour like any other, and there is one way to say what a press does
    { name: "uiHost.openCanvas", opens: "canvas" },
    { name: "uiHost.openTheme", opens: "theme" },
    { name: "uiHost.openCatalog", opens: "catalog" },
    { name: "uiHost.openAnnouncements", opens: "announcements" },
    // A press names the canvas and enters its screen. Reading it is the screen's
    // own business (`onEnter`), so a row and a pasted link are one act and there
    // is one read rather than one per door.
    { name: "uiHost.loadCanvas", method: "GET", url: "/ui/api/canvas", result: "/canvas/loaded",
      params: { canvasId: { state: "/_nav/canvasId" } } },
    { name: "uiHost.setTheme", method: "POST", url: "/ui/api/command", result: "/commands/results/theme", refresh: ["runtime"] },
    // One press per declared read, for the failures that need one (§9): the
    // press makes no call, repeats the read that failed, and writes nothing.
    ...Object.values(readRetries),
  ],
  nodes: [
    uiHostHeader,
    // The list is as long as the host's own registry, and how long that is is not
    // the surface's business: the canvases scroll in their own box, under a
    // header that holds the doors and stays where it was.
    region([
      canvasesSection,
      // The runtime answers with the canvas it is showing and nothing else, so an
      // empty answer is the normal case rather than a verdict: this source
      // reports only the two states that are true, reading and failed.
      loadingRows("runtime", 1),
      readFailed("runtime", "Could not read which canvas is in view."),
    ]),
  ],
  screens: [
    { id: "canvas", title: "Canvas", onEnter: "uiHost.loadCanvas", nodes: canvasNodes },
    { id: "theme", title: "Theme", nodes: themeNodes },
    { id: "catalog", title: "Catalog", nodes: catalogNodes },
    { id: "announcements", title: "Announcements", nodes: announcementsNodes },
  ],
}
