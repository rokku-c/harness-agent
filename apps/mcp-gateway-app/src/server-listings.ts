/**
 * What the gateway asked each server, and what came back.
 *
 * A server's record says what it is; whether the door can offer anything through
 * it is a second fact about the same server, so it is written into the same row
 * rather than into a list beside it — two lists about one server are two places
 * to read one thing, and joining them by id is the operator's work, not the
 * page's.
 *
 * Three answers, and the third is why this is not the load report itself: a
 * server that is offline is never asked at all. A report of only what was loaded
 * and what failed would say nothing about the case an operator meets most often
 * — a server that is down — leaving the absence of tools unexplained.
 */
import type { CatalogLoadReport } from "@effect-agent/mcp-gateway"
import type { McpServerRecord } from "@effect-agent/mcp-registry"

export interface Listing {
  readonly state: "listed" | "failed" | "not asked"
  /** What listing it said, word for word. Only a failed listing has one. */
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
