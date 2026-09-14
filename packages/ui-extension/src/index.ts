import { UIError, type ComponentDefinition, type ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"

export interface UIExtension { readonly manifest: ExtensionManifest; readonly components?: ReadonlyArray<ComponentDefinition> }
export interface ExtensionRegistry { enable(extension: UIExtension): void; disable(name: string): void; list(): ReadonlyArray<ExtensionManifest> }

export const makeExtensionRegistry = (definitions: DefinitionStore): ExtensionRegistry => {
  const active = new Map<string, UIExtension>()
  const baseline = new Map(definitions.listComponents().map((item) => [item.type, item]))
  const claimed = new Set<string>()
  const rebuild = (): void => {
    const wanted = new Map(baseline)
    for (const extension of active.values())
      for (const component of extension.components ?? []) { wanted.set(component.type, component); claimed.add(component.type) }
    for (const type of claimed) if (!wanted.has(type)) definitions.unregisterComponent(type)
    for (const definition of wanted.values())
      if (definitions.getComponent(definition.type) !== definition) definitions.registerComponent(definition)
  }
  return {
    enable: (extension) => {
      if (active.has(extension.manifest.name)) throw new UIError("invalid-tree", "extension already enabled: " + extension.manifest.name)
      if ((extension.components?.length ?? 0) > 0 && !extension.manifest.permissions.includes("render")) throw new UIError("invalid-tree", "extension needs render permission")
      active.set(extension.manifest.name, extension)
      try { rebuild() } catch (error) { active.delete(extension.manifest.name); rebuild(); throw error }
    },
    disable: (name) => { if (active.delete(name)) rebuild() },
    list: () => [...active.values()].map((item) => item.manifest)
  }
}
