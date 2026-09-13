/**
 * mcp-gateway — filling the catalog from live upstreams.
 *
 * Listing is best-effort per server: one unreachable upstream must not take the
 * whole gateway down, so each failure is reported rather than thrown. A server
 * that fails keeps the tools it last advertised — a transient blip should not
 * make the surface flap, and clients cache tool lists aggressively. That is the
 * safe direction: a stale entry can only ever lead to a call that enforcement
 * still checks and upstream still rejects, never to a call that skips a check.
 *
 * The list given here is the whole catalog, so a server that is no longer in it
 * is forgotten. Keeping an offline server's tools advertised would be the one
 * direction that is not safe: a door offering a tool it cannot carry.
 */

import type { CatalogTool, McpToolLister, ToolCatalog } from "./catalog.ts"
import type { McpGatewayServer } from "./contract-sets.ts"

export interface CatalogFailure {
  readonly serverId: string
  readonly detail: string
}

export interface CatalogLoadReport {
  readonly loaded: readonly string[]
  readonly failed: readonly CatalogFailure[]
}

type Outcome =
  | { readonly ok: true; readonly serverId: string }
  | { readonly ok: false; readonly serverId: string; readonly detail: string }

export const loadToolCatalog = async (
  catalog: ToolCatalog,
  lister: McpToolLister,
  servers: readonly McpGatewayServer[],
): Promise<CatalogLoadReport> => {
  const outcomes: Outcome[] = await Promise.all(
    servers.map(async (server): Promise<Outcome> => {
      try {
        const tools: readonly CatalogTool[] = await lister.list(server)
        catalog.replace(server.serverId, tools)
        return { ok: true, serverId: server.serverId }
      } catch (cause) {
        return { ok: false, serverId: server.serverId, detail: cause instanceof Error ? cause.message : String(cause) }
      }
    }),
  )
  const known = new Set(servers.map((server) => server.serverId))
  for (const advertised of new Set(catalog.list().map((entry) => entry.serverId))) {
    if (!known.has(advertised)) catalog.forget(advertised)
  }
  const loaded: string[] = []
  const failed: CatalogFailure[] = []
  for (const outcome of outcomes) {
    if (outcome.ok) loaded.push(outcome.serverId)
    else failed.push({ serverId: outcome.serverId, detail: outcome.detail })
  }
  return { loaded, failed }
}
