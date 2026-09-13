/**
 * The reads: what the canvas is, and what it is made of.
 *
 * Each carries the route the console already reads it at, so the browser and an
 * agent are looking at one answer rather than two that have to be kept in step.
 * Those paths are the console's own and are kept as they were: a page is
 * already loaded when a request arrives, and a rename here would break it.
 */
import { noInput, operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { UiSurfaces } from "./surfaces.ts"

export const readOperations = ({ runtime, definitions, renderers, extensions }: UiSurfaces): readonly Operation[] => [
  operation({
    name: "ui_get_canvas",
    description: "Read a canvas as resolved, or the active canvas when no id is given",
    access: "read", input: z.object({ canvasId: z.string().min(1).optional() }).strict(),
    http: { method: "GET", path: "/api/canvas" },
    handler: (input) => input.canvasId === undefined ? runtime.view() : runtime.viewCanvas(input.canvasId),
  }),
  operation({
    name: "ui_get_runtime_state",
    description: "Read the active canvas navigation, the theme in force, and the renderer serving it",
    access: "read", input: noInput, http: { method: "GET", path: "/api/runtime" },
    handler: () => ({ navigation: runtime.navigation(), theme: runtime.theme(), renderer: runtime.renderer() }),
  }),
  operation({
    name: "ui_list_canvases",
    description: "List every declared canvas by id, title, and version",
    access: "read", input: noInput, http: { method: "GET", path: "/api/canvases" },
    handler: () => Object.values(definitions.snapshot().canvases)
      .map((canvas) => ({ canvasId: canvas.canvasId, title: canvas.title, version: canvas.version })),
  }),
  operation({
    name: "ui_list_components",
    description: "List the component definitions a canvas may be built from",
    access: "read", input: noInput, http: { method: "GET", path: "/api/components" },
    handler: () => definitions.listComponents(),
  }),
  operation({
    name: "ui_list_renderers",
    description: "List the renderer implementations this host serves",
    access: "read", input: noInput, http: { method: "GET", path: "/api/renderers" },
    handler: () => renderers.list(),
  }),
  operation({
    name: "ui_list_extensions",
    description: "List the UI extensions currently enabled",
    access: "read", input: noInput, http: { method: "GET", path: "/api/extensions" },
    handler: () => extensions.list(),
  }),
]
