/**
 * mcp-gateway — the advertised tool surface.
 *
 * One caller, one list, and the list is not computed here: every tool in it was
 * offered to the engine, and the engine answered. The projection is therefore
 * the enforcement — `tools/call` runs the same `decide` with the same arguments
 * and reaches the same verdict, so a tool that is missing here is a tool the
 * call refuses and a tool that is here is a tool the call carries. There is no
 * second visibility rule to drift from the first.
 *
 * A request that resolves to no principal is advertised nothing rather than
 * refused: `tools/list` has no channel for a refusal, and the direct call still
 * answers in full.
 */
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
  /** The one decision. The surface asks it; the door runs it. */
  readonly gateway: McpGateway
  readonly catalog: ToolCatalog
  /** Brings `catalog` up to date before it is read. Absent means it already is. */
  readonly refresh?: () => Promise<void>
  readonly tokens?: TokenStore
  readonly principals?: PrincipalRegistry
  /** Declares the transport trustworthy, which is what lets bare claim headers count. */
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

/** The entries this principal may call, in catalog order — asked of the engine, one by one. */
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

/** Resolves an advertised name back to the upstream tool it stands for. */
export const surfaceTarget = (surface: McpToolSurface, advertised: string): CatalogEntry | undefined =>
  surface.catalog.find(advertised)
