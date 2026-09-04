import type { ComponentDefinition } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "./index.ts"

export const builtinComponents: ReadonlyArray<ComponentDefinition> = [
  { type: "Text", version: "1", category: "base", capabilities: { acceptsChildren: false } },
  { type: "Button", version: "1", category: "base", capabilities: { acceptsChildren: false } },
  { type: "Input", version: "1", category: "base", capabilities: { acceptsChildren: false } },
  { type: "Stack", version: "1", category: "base", capabilities: { acceptsChildren: true } },
  { type: "CanvasRef", version: "1", category: "canvas", capabilities: { requiredProps: ["targetCanvasId"] } },
  { type: "Slot", version: "1", category: "base", capabilities: { requiresParent: true } }
]

export const registerBuiltins = (store: DefinitionStore): DefinitionStore => {
  for (const definition of builtinComponents) store.registerComponent(definition)
  return store
}
