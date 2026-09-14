/**
 * The moves that change how the canvas is presented rather than what is on it:
 * the components available to build with, the data the nodes read, and the theme
 * the canvas is drawn in.
 *
 * The theme is host state rather than node state, so it is stated once here and
 * read back through `ui_get_runtime_state` - a screen that named its own theme
 * could disagree with the one actually drawing it. The renderer was once the
 * second of those; it is not one any more, because there is exactly one drawing
 * surface now - the console - and a setting with a single value is not a setting.
 */
import { operation, type Operation } from "@effect-agent/effect-interface"
import { z } from "@effect-agent/effect-config"
import type { UiSurfaces } from "./surfaces.ts"

export const presentationOperations = ({ runtime, definitions }: UiSurfaces): readonly Operation[] => [
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
    description: "Switch the theme the canvas is drawn in",
    input: z.object({ theme: z.string().min(1) }).strict(),
    handler: (input) => { runtime.apply({ kind: "set-theme", theme: input.theme }); return { ok: true, theme: input.theme } },
  }),
]
