import { makeNodeOperationTable, nodeOperationSummary, type AppCatalog } from "@effect-agent/effect-apps"
import type { EffectPluginHost } from "@effect-agent/effect-host"
import type { EffectRegistry } from "@effect-agent/effect-interface"
import type { ConfigRegistry } from "@effect-agent/effect-config"
import type { EffectUiView } from "@effect-agent/effect-ui"
import { makeLiveAppCatalog } from "../apps-catalog.ts"
import type { EffectServer } from "./options.ts"

const jsonResponse = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })

export interface AppCatalogServices {
  readonly host: EffectPluginHost
  readonly registry: EffectRegistry
  readonly configs: ConfigRegistry
  readonly uiViews: ReadonlyMap<string, EffectUiView>
}

/**
 * The catalog is a live view over the host's services (§4), not a snapshot of one
 * kernel's registrations — which is why it can be built once and shared with every
 * kernel revision.
 */
export const makeAppCatalog = (services: AppCatalogServices): AppCatalog => makeLiveAppCatalog({
  registry: services.registry,
  configs: services.configs,
  uiViews: services.uiViews,
  // Local single-operator host. Config credentials are never in the agent plane.
  authorize: (_id: string, plane: string) => plane !== "config",
  stateReader: async (id: string) => {
    if (id !== "board") return undefined
    const res = await services.host.handle(new Request("http://effect/board/api/state"))
    return res.ok ? await res.json() : undefined
  },
})

/**
 * §4's one table, served: the host's privileged plane and every app's tools, each
 * with its schema. Read-only by construction — the summary carries no invoke, so
 * this route describes and never acts (acting stays on /-/planes).
 */
export const registerInfra = (app: EffectServer, catalog: AppCatalog): void => {
  // Read-only service view for chrome and apps; mutating lifecycle stays on /-/planes.
  app.host.registerRoute({
    path: "/-/status",
    method: "GET",
    handle: async () => jsonResponse(app.host.list()),
  })
  app.host.registerRoute({
    path: "/-/operations",
    method: "GET",
    handle: async () => jsonResponse(makeNodeOperationTable(app.host, catalog.list()).list().map(nodeOperationSummary)),
  })
}
