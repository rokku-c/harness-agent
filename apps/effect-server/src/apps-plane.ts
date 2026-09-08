import { buildAppsMcpServer, type AppCatalog } from "@effect-agent/effect-apps"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import type { EffectPlugin } from "@effect-agent/effect-host"
import { makeLiveAppCatalog, type AppsCatalogOptions } from "./apps-catalog.ts"

export type AppsPlaneOptions = AppsCatalogOptions & { readonly catalog?: AppCatalog }
export const makeAppsPlane = (options: AppsPlaneOptions): EffectPlugin => {
  const catalog = options.catalog ?? makeLiveAppCatalog(options)
  const handler = serveMcpHttp(() => Promise.resolve(buildAppsMcpServer(catalog)))
  return { id: "effect-apps", priority: 15, load: async () => ({
    canHandle: (path) => path === "/effect-apps", handle: handler,
  }) }
}
