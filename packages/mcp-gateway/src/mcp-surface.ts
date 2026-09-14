import type { Principal } from "@effect-agent/effect-authz"

import type { CatalogEntry, ToolCatalog } from "./catalog.ts"
import type { McpGateway } from "./contract.ts"
import type { HeaderBag, McpAuthIdentity } from "./identity.ts"
import type { PrincipalRegistry } from "./principals.ts"
import { type PrincipalResolution, resolvePrincipal } from "./resolve.ts"
import type { TokenStore } from "./token.ts"

export interface SurfaceRequest {
  readonly headers?: HeaderBag
  readonly authInfo?: McpAuthIdentity
}

export interface McpToolSurface {
  readonly gateway: McpGateway
  readonly catalog: ToolCatalog
  readonly refresh?: () => Promise<void>
  readonly tokens?: TokenStore
  readonly principals?: PrincipalRegistry
  readonly trusted?: boolean
}

export interface SurfaceTool {
  readonly name: string
  readonly description?: string
  readonly inputSchema: unknown
}

export const resolveSurfacePrincipal = (
  surface: McpToolSurface,
  request: SurfaceRequest,
): PrincipalResolution =>
  resolvePrincipal({
    headers: request.headers,
    ...(request.authInfo === undefined ? {} : { claims: request.authInfo.extra }),
    tokens: surface.tokens,
    principals: surface.principals,
    trusted: surface.trusted,
  })

const asTool = (entry: CatalogEntry): SurfaceTool => ({
  name: entry.advertised,
  ...(entry.description === undefined ? {} : { description: entry.description }),
  inputSchema: entry.inputSchema ?? { type: "object", additionalProperties: true },
})

export const visibleEntries = async (
  surface: McpToolSurface,
  principal: Principal,
): Promise<readonly CatalogEntry[]> => {
  const entries = surface.catalog.list()
  const verdicts = await Promise.all(entries.map((entry) =>
    surface.gateway.decide({ callId: `list:${entry.advertised}`, principal, serverId: entry.serverId, tool: entry.tool })))
  return entries.filter((_, index) => verdicts[index]?.allowed === true)
}

export const surfaceTools = async (
  surface: McpToolSurface,
  resolution: PrincipalResolution,
): Promise<readonly SurfaceTool[]> =>
  resolution.principal === undefined ? [] : (await visibleEntries(surface, resolution.principal)).map(asTool)

export const surfaceTarget = (surface: McpToolSurface, advertised: string): CatalogEntry | undefined =>
  surface.catalog.find(advertised)
