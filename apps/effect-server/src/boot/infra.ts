import { makeNodeOperationTable, nodeOperationSummary, type AppCatalog } from "@effect-agent/effect-apps"
import { json, type EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import { makeLiveAppCatalog } from "../apps-catalog.ts"
import type { EffectServer } from "./options.ts"

export interface AppCatalogServices {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly uiViews: ReadonlyMap<string, EffectUiView>
}

export const makeHostCatalog = (services: AppCatalogServices): AppCatalog => makeLiveAppCatalog({
  registry: services.registry,
  configs: services.configs,
  uiViews: services.uiViews,
  authorize: (_id: string, plane: string) => plane !== "config",
  stateReader: async (id: string) => {
    if (id !== "board") return undefined
    const res = await services.host.handle(new Request("http://effect/board/api/state"))
    return res.ok ? await res.json() : undefined
  },
})

export const registerInfra = (app: EffectServer, catalog: AppCatalog): void => {
  app.host.registerRoute({
    path: "/-/status",
    method: "GET",
    handle: async () => json(app.host.list()),
  })
  app.host.registerRoute({
    path: "/-/operations",
    method: "GET",
    handle: async () => json(makeNodeOperationTable(app.host, catalog.list()).list().map(nodeOperationSummary)),
  })
}
