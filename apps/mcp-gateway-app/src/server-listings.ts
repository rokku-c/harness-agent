import type { CatalogLoadReport } from "@effect-agent/mcp-gateway"
import type { McpServerRecord } from "@effect-agent/mcp-registry"

export interface Listing {
  readonly state: "listed" | "failed" | "not asked"
  readonly detail?: string
}

export type ListedServer = McpServerRecord & { readonly listing: Listing }

export const withListings = (servers: readonly McpServerRecord[], report: CatalogLoadReport): readonly ListedServer[] =>
  servers.map((server): ListedServer => {
    if (server.status === "offline") return { ...server, listing: { state: "not asked" } }
    const failure = report.failed.find((one) => one.serverId === server.serverId)
    if (failure !== undefined) return { ...server, listing: { state: "failed", detail: failure.detail } }
    return { ...server, listing: { state: report.loaded.includes(server.serverId) ? "listed" : "not asked" } }
  })
