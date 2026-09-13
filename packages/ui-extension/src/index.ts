import { UIError, type ComponentDefinition, type ExtensionManifest } from "@effect-agent/ui-protocol"
import type { DefinitionStore } from "@effect-agent/ui-definition"

export interface UIExtension { readonly manifest: ExtensionManifest; readonly components?: ReadonlyArray<ComponentDefinition> }
export interface ExtensionRegistry { enable(extension: UIExtension): void; disable(name: string): void; list(): ReadonlyArray<ExtensionManifest> }

export const makeExtensionRegistry = (definitions: DefinitionStore): ExtensionRegistry => {
  const active = new Map<string, UIExtension>()
  // The store's components are the ones it started with, plus what is enabled —
  // so enable and disable rebuild from that instead of remembering the definition
  // each extension displaced and putting it back. The old guard asked whether the
  // component in the store still carried the version this extension declared,
  // and a version is a label: two extensions both declaring `Chart` at version
  // "1" are one string, so disabling the first took the second's component away
  // and said nothing. The restore chain had the same shape one level down — the
  // prior it put back could belong to an extension that was already disabled.
  const baseline = new Map(definitions.listComponents().map((item) => [item.type, item]))
  const claimed = new Set<string>()
  const rebuild = (): void => {
    const wanted = new Map(baseline)
    for (const extension of active.values())
      for (const component of extension.components ?? []) { wanted.set(component.type, component); claimed.add(component.type) }
    // Only what an extension claimed: a component the host registered itself is
    // not this registry's to take away.
    for (const type of claimed) if (!wanted.has(type)) definitions.unregisterComponent(type)
    for (const definition of wanted.values())
      if (definitions.getComponent(definition.type) !== definition) definitions.registerComponent(definition)
  }
  return {
    enable: (extension) => {
      if (active.has(extension.manifest.name)) throw new UIError("invalid-tree", "extension already enabled: " + extension.manifest.name)
      if ((extension.components?.length ?? 0) > 0 && !extension.manifest.permissions.includes("render")) throw new UIError("invalid-tree", "extension needs render permission")
      active.set(extension.manifest.name, extension)
      // A component the store refuses — a recursive template, an undeclared slot
      // — takes the extension back out. Half of one is not a state this registry
      // has, and the enable reported failure.
      try { rebuild() } catch (error) { active.delete(extension.manifest.name); rebuild(); throw error }
    },
    disable: (name) => { if (active.delete(name)) rebuild() },
    list: () => [...active.values()].map((item) => item.manifest)
  }
}
