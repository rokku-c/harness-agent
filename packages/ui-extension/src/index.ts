import { UIError, type ComponentDefinition, type ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"

export interface UIExtension { readonly manifest: ExtensionManifest; readonly components?: ReadonlyArray<ComponentDefinition> }
export interface ExtensionRegistry { enable(extension: UIExtension): void; disable(name: string): void; list(): ReadonlyArray<ExtensionManifest> }

export const makeExtensionRegistry = (definitions: DefinitionStore): ExtensionRegistry => {
  const active = new Map<string, UIExtension>()
  const enable = (extension: UIExtension): void => {
    if (active.has(extension.manifest.name)) throw new UIError("invalid-tree", "extension already enabled: " + extension.manifest.name)
    for (const component of extension.components ?? []) definitions.registerComponent(component)
    active.set(extension.manifest.name, extension)
  }
  return { enable, disable: (name) => { active.delete(name) }, list: () => [...active.values()].map((item) => item.manifest) }
}
