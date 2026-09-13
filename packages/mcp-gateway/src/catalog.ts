/**
 * mcp-gateway — the upstream tool catalog.
 *
 * The gateway advertises upstream tools as its own: one flat tool per
 * (server, tool) pair, so a client sees a real surface instead of a single
 * multiplexed call. Advertised names are keys into this table, never parsed
 * back into their parts — a tool whose own name contains the separator cannot
 * then be mistaken for a different server's.
 *
 *   advertised = "<serverId>.<tool>", every character outside [A-Za-z0-9_-] → "_"
 *
 * Two entries that would advertise the same name is a configuration error and
 * fails loudly here. Dropping one silently would hide a real tool behind a
 * view the operator never wrote.
 */

import type { McpGatewayServer } from "./contract.ts"

export interface CatalogTool {
  readonly name: string
  readonly description?: string
  readonly inputSchema?: unknown
}

export interface CatalogEntry {
  readonly serverId: string
  readonly tool: string
  readonly advertised: string
  readonly description?: string
  readonly inputSchema?: unknown
}

/** How the gateway learns a server's tools. The app supplies the transport. */
export interface McpToolLister {
  list(server: McpGatewayServer): Promise<readonly CatalogTool[]>
}

export interface ToolCatalog {
  /** Replaces one server's tools wholesale; throws if a name would collide. */
  replace(serverId: string, tools: readonly CatalogTool[]): void
  forget(serverId: string): void
  list(): readonly CatalogEntry[]
  find(advertised: string): CatalogEntry | undefined
}

const slug = (value: string): string => value.replace(/[^A-Za-z0-9_-]/g, "_")

export const advertisedName = (serverId: string, tool: string): string => `${slug(serverId)}.${slug(tool)}`

const entryOf = (serverId: string, tool: CatalogTool): CatalogEntry => ({
  serverId,
  tool: tool.name,
  advertised: advertisedName(serverId, tool.name),
  ...(tool.description === undefined ? {} : { description: tool.description }),
  ...(tool.inputSchema === undefined ? {} : { inputSchema: tool.inputSchema }),
})

export const makeToolCatalog = (): ToolCatalog => {
  const byServer = new Map<string, readonly CatalogEntry[]>()
  let index = new Map<string, CatalogEntry>()

  const reindex = (): void => {
    index = new Map()
    for (const entries of byServer.values()) {
      for (const entry of entries) index.set(entry.advertised, entry)
    }
  }

  const replace = (serverId: string, tools: readonly CatalogTool[]): void => {
    const entries = tools.map((tool) => entryOf(serverId, tool))
    const elsewhere = new Set<string>()
    for (const [other, list] of byServer) {
      if (other === serverId) continue
      for (const entry of list) elsewhere.add(entry.advertised)
    }
    for (const entry of entries) {
      if (elsewhere.has(entry.advertised)) throw new Error(`tool catalog: ${entry.advertised} is already advertised by another server`)
    }
    if (new Set(entries.map((entry) => entry.advertised)).size !== entries.length) {
      throw new Error(`tool catalog: server ${serverId} advertises a duplicate tool name`)
    }
    byServer.set(serverId, entries)
    reindex()
  }

  return {
    replace,
    forget: (serverId) => { byServer.delete(serverId); reindex() },
    list: () => [...byServer.values()].flat(),
    find: (advertised) => index.get(advertised),
  }
}
