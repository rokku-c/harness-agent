import type { Registry, McpServerRecord } from "@effect-agent/mcp-registry"
import { loadToolCatalog, type CatalogLoadReport, type McpGatewayServer, type McpToolLister, type ToolCatalog } from "@effect-agent/mcp-gateway"

export interface LiveCatalog {
  refresh(): Promise<void>
  report(): CatalogLoadReport
}

const EMPTY: CatalogLoadReport = { loaded: [], failed: [] }

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
