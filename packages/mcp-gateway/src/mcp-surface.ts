/**
 * mcp-gateway — the advertised tool surface.
 *
 * One caller, one list. The surface is what `tools/list` answers with, derived
 * by the same engine that decides `tools/call`, so a tool that is missing here
 * is a tool the call refuses.
 *
 * A request that resolves to no principal gets an empty surface rather than an
 * error: `tools/list` has no channel for a refusal, and the direct call still
 * answers `no_principal` in full.
 */

import type { Authz, Principal } from "@effect-agent/effect-authz"

import { toolRefResource, visibleToolRefs } from "./authorize.ts"
import type { CatalogEntry, ToolCatalog } from "./catalog.ts"
import type { McpAuthIdentity, HeaderBag } from "./identity.ts"
import type { PrincipalRegistry } from "./principals.ts"
import { type PrincipalResolution, resolvePrincipal } from "./resolve.ts"
import type { TokenStore } from "./token.ts"

export interface SurfaceRequest {
  readonly headers?: HeaderBag
  readonly authInfo?: McpAuthIdentity
}

export interface McpToolSurface {
  readonly authz: Authz
  readonly catalog: ToolCatalog
  readonly tokens?: TokenStore
  readonly principals?: PrincipalRegistry
  /** Declares the transport trustworthy, which is what lets bare headers count. */
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

const project = (surface: McpToolSurface, principal: Principal): readonly CatalogEntry[] => {
  const entries = surface.catalog.list()
  const refs = entries.map((entry) => ({ serverId: entry.serverId, tool: entry.tool }))
  const visible = new Set(visibleToolRefs(surface.authz, principal, refs).map((ref) => toolRefResource(ref).raw))
  return entries.filter((entry) => visible.has(toolRefResource(entry).raw))
}

export const surfaceTools = (surface: McpToolSurface, resolution: PrincipalResolution): readonly SurfaceTool[] =>
  resolution.principal === undefined ? [] : project(surface, resolution.principal).map(asTool)

/** Resolves an advertised name back to the upstream tool it stands for. */
export const surfaceTarget = (surface: McpToolSurface, advertised: string): CatalogEntry | undefined =>
  surface.catalog.find(advertised)
