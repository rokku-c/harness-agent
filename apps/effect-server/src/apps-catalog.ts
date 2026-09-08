import type { AppCatalog, AppEntry, AppsPlane } from "@effect-agent/effect-apps"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"

export interface AppsCatalogOptions {
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly uiViews?: ReadonlyMap<string, EffectUiView>
  readonly namespace?: string
  readonly stateReader?: (appId: string) => unknown | Promise<unknown>
  /** Trusted host policy, not an identity inferred from a request-supplied namespace. */
  readonly authorize?: (appId: string, plane: AppsPlane) => boolean
}
export const makeLiveAppCatalog = (options: AppsCatalogOptions): AppCatalog => {
  const ns = options.namespace ?? "ops"
  const ids = () => new Set([
    ...options.registry.apps().map((a) => a.interfaceId),
    ...options.registry.tools().map((t) => t.interfaceId),
    ...options.configs.list().map((c) => c.appId), ...options.uiViews?.keys() ?? [],
  ].filter((id) => !id.includes("::") || id.startsWith(`${ns}::`))
    .map((id) => id.startsWith(`${ns}::`) ? id.slice(ns.length + 2) : id)
    .filter((id) => !id.includes("::")))
  const entryFor = (id: string): AppEntry => ({
    ns, appId: id,
    registry: options.registry.tools().some((t) => t.interfaceId === id || t.interfaceId === `${ns}::${id}`) ? options.registry : undefined,
    ui: options.uiViews?.has(id) ? { doc: () => options.uiViews!.get(id), state: () => options.stateReader?.(id) } : undefined,
    config: options.configs.get(id) ? {
      schema: () => options.configs.schemaFor(id), value: () => options.configs.read(id).value,
      sources: () => options.configs.read(id).sources,
    } : undefined,
    authorize: (plane) => options.authorize?.(id, plane) ?? false,
  })
  return {
    register: () => { throw new Error("Live catalog is derived; register with the owning app registry") },
    list: () => [...ids()].map(entryFor),
    find: (targetNs, id) => targetNs === ns && ids().has(id) ? entryFor(id) : undefined,
  }
}
