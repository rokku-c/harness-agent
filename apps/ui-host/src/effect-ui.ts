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
    { name: "uiHost.openCanvas", opens: "canvas" },
    { name: "uiHost.openTheme", opens: "theme" },
    { name: "uiHost.openCatalog", opens: "catalog" },
    { name: "uiHost.openAnnouncements", opens: "announcements" },
    { name: "uiHost.loadCanvas", method: "GET", url: "/ui/api/canvas", result: "/canvas/loaded",
      params: { canvasId: { state: "/_nav/canvasId" } } },
    { name: "uiHost.setTheme", method: "POST", url: "/ui/api/command", result: "/commands/results/theme", refresh: ["runtime"] },
    ...Object.values(readRetries),
  ],
  nodes: [
    uiHostHeader,
    region([
      canvasesSection,
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
