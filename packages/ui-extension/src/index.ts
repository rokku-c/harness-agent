import { UIError, type ComponentDefinition, type ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"

export interface UIExtension { readonly manifest: ExtensionManifest; readonly components?: ReadonlyArray<ComponentDefinition> }
export interface ExtensionRegistry { enable(extension: UIExtension): void; disable(name: string): void; list(): ReadonlyArray<ExtensionManifest> }

export const makeExtensionRegistry = (definitions: DefinitionStore): ExtensionRegistry => {
  const active = new Map<string, UIExtension>()
  const previous = new Map<string, Map<string, ComponentDefinition | undefined>>()
  const enable = (extension: UIExtension): void => {
    if (active.has(extension.manifest.name)) throw new UIError("invalid-tree", "extension already enabled: " + extension.manifest.name)
    const old = new Map<string, ComponentDefinition | undefined>()
    for (const component of extension.components ?? []) { old.set(component.type, definitions.getComponent(component.type)); definitions.registerComponent(component) }
    previous.set(extension.manifest.name, old)
    active.set(extension.manifest.name, extension)
  }
  return {
    enable,
    disable: (name) => {
      const extension = active.get(name)
      if (extension === undefined) return
      const old = previous.get(name)
      for (const component of extension.components ?? []) {
        definitions.unregisterComponent(component.type)
        const prior = old?.get(component.type)
        if (prior !== undefined) definitions.registerComponent(prior)
      }
      previous.delete(name)
      active.delete(name)
    },
    list: () => [...active.values()].map((item) => item.manifest)
  }
}
