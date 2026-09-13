/**
 * What the gateway is currently able to offer.
 *
 * The catalog is rebuilt when the *topology* changes — the set of live servers
 * in the registry — and not on a clock. A gateway with a timer would advertise
 * a tool for a server that went away for as long as the timer's period, and the
 * point of the surface is that it is true when it is read.
 *
 * The boundary is therefore stated rather than hidden: a server that comes back
 * with different tools but the same id is not noticed until it leaves and
 * returns, or the app reloads. That is the one case a change of topology does
 * not describe, and it is written down here instead of being papered over with
 * a refresh interval nobody can predict the cost of.
 */
import type { Registry, McpServerRecord } from "@effect-agent/mcp-registry"
import { loadToolCatalog, type CatalogLoadReport, type McpGatewayServer, type McpToolLister, type ToolCatalog } from "@effect-agent/mcp-gateway"

export interface LiveCatalog {
  /** Makes the catalog describe the live topology. Cheap when nothing changed. */
  refresh(): Promise<void>
  /** How the last rebuild went; what the console shows beside the topology. */
  report(): CatalogLoadReport
}

const EMPTY: CatalogLoadReport = { loaded: [], failed: [] }

/** The registry record, in the shape the gateway routes and lists through. */
const asServer = (record: McpServerRecord): McpGatewayServer => ({
  serverId: record.serverId, name: record.name, era: record.era,
  transport: record.transport.kind, endpoint: record.transport.endpoint,
  ...(record.transport.command === undefined ? {} : { command: record.transport.command }),
})

export const makeLiveCatalog = (catalog: ToolCatalog, lister: McpToolLister, registry: Registry): LiveCatalog => {
  let built: string | undefined
  let pending: Promise<void> | undefined
  let outcome: CatalogLoadReport = EMPTY
  const live = (): readonly McpGatewayServer[] => registry.list().filter((record) => record.status !== "offline").map(asServer)

  const refresh = async (): Promise<void> => {
    const servers = live()
    const signature = servers.map((server) => server.serverId).sort().join("|")
    if (signature === built) return
    if (pending !== undefined) return pending
    const task = loadToolCatalog(catalog, lister, servers)
      .then((report) => { outcome = report; built = signature })
      .finally(() => { pending = undefined })
    pending = task
    return task
  }

  return { refresh, report: () => outcome }
}
