/**
 * The moves that change how the canvas is presented rather than what is on it:
 * the components available to build with, the data the nodes read, and the
 * theme and renderer serving the page.
 *
 * A theme and a renderer are host state rather than node state, so they are
 * stated once here and read back through `ui_get_runtime_state` - a page that
 * named its own renderer could disagree with the one actually drawing it.
 */
import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { UiSurfaces } from "./surfaces.ts"

export const presentationOperations = ({ runtime, definitions, renderers }: UiSurfaces): readonly Operation[] => [
  operation({
    name: "ui_register_component",
    description: "Register a declarative component definition; no code is executed",
    input: z.object({ type: z.string().min(1), version: z.string().min(1),
      category: z.enum(["base", "composite", "canvas", "extension"]),
      acceptsChildren: z.boolean().optional(), acceptsSlots: z.boolean().optional() }).strict(),
    handler: (input) => {
      definitions.registerComponent({ type: input.type, version: input.version, category: input.category,
        capabilities: { acceptsChildren: input.acceptsChildren, acceptsSlots: input.acceptsSlots } })
      return { ok: true, type: input.type, version: input.version }
    },
  }),
  operation({
    name: "ui_set_data",
    description: "Set a value in the data store every canvas resolves its bindings against",
    input: z.object({ path: z.string().min(1), value: z.unknown() }).strict(),
    handler: (input) => {
      runtime.apply({ kind: "set-data", path: input.path, value: input.value as never })
      return { ok: true, path: input.path }
    },
  }),
  operation({
    name: "ui_set_theme",
    description: "Switch the theme the page is rendered in",
    input: z.object({ theme: z.string().min(1) }).strict(),
    handler: (input) => { runtime.apply({ kind: "set-theme", theme: input.theme }); return { ok: true, theme: input.theme } },
  }),
  operation({
    name: "ui_set_renderer",
    description: "Switch the renderer serving the page, refused if this host does not have it",
    input: z.object({ renderer: z.string().min(1) }).strict(),
    handler: (input) => {
      if (renderers.get(input.renderer) === undefined) return { ok: false, error: "renderer not found: " + input.renderer }
      runtime.apply({ kind: "set-renderer", renderer: input.renderer })
      return { ok: true, renderer: input.renderer }
    },
  }),
]
