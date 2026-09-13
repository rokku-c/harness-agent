/**
 * The gateway app: the door, and the console that explains it.
 *
 * One surface is built here and both faces are projections of it. The door
 * advertises what the engine allows and carries the same thing; the console
 * reads the same registry, the same sets, and the same catalog, so an operator's
 * answer and an agent's call cannot disagree — which they would the moment the
 * console kept its own copy of what it was explaining.
 *
 * The door authenticates every request itself. `authenticate` is handed to the
 * transport, so the tool handlers are given a caller the door named or nothing
 * at all, and no header reaches a decision as an identity. That is the whole
 * point of this app: the door is one place, and it verifies before it speaks.
 *
 * The catalog is the upstream's own listing, refreshed when the live topology
 * changes, so `tools/list` and a proxied call go through the same client and see
 * the same tools.
 */
import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { toEffectTools, toHttpHandler } from "@effect-agent/effect-interface"
import {
  authenticateRequest, buildMcpGatewayServer, makeIdentityStore, makeMcpGateway, makeMcpSetRegistry,
  makeRegistryHttpUpstream, makeRegistrySetResolver, makeToolCatalog, type McpToolSurface,
} from "@effect-agent/mcp-gateway"
import { makeAuditLog } from "./audit-log.ts"
import { effectConfig } from "./effect-config.ts"
import { makeLiveCatalog } from "./live-catalog.ts"
import { mcpGatewayOperations } from "./ops.ts"

const notFound = (): Response => Response.json({ ok: false, error: "Not found" }, { status: 404 })

export const createMcpGatewayPlugin = (getConfig: () => unknown, context: AppRuntimeContext): EffectPlugin => ({
  id: "mcp-gateway", priority: 20,
  load: async (): Promise<LoadedPlane> => {
    const registry = context.mcpRegistry
    if (!registry) throw new Error("mcp-gateway requires the shared MCP Registry")
    const config = effectConfig.schema.parse(getConfig())
    const sets = makeMcpSetRegistry({ resolver: makeRegistrySetResolver(registry) })
    for (const set of config.sets) sets.registerSet(set)
    for (const binding of config.bindings) sets.bindAgent(binding)
    const upstream = makeRegistryHttpUpstream({ registry, fetch: context.fetch })
    const audit = makeAuditLog()
    const store = makeIdentityStore(config.databaseFile)
    const catalog = makeToolCatalog()
    const live = makeLiveCatalog(catalog, upstream, registry)
    const gateway = makeMcpGateway({ setRegistry: sets, upstream, captureArgs: config.captureArgs, recorder: audit })
    // what the door offers, what it decides with, and who it will name
    const surface: McpToolSurface = {
      gateway, catalog, refresh: live.refresh, tokens: store.tokens, principals: store.principals,
    }
    const mcp = serveMcpHttp(() => Promise.resolve(buildMcpGatewayServer(surface)), {
      authenticate: (request) => authenticateRequest(store, request),
    })
    // one list, two projections: what the console reads and what an agent calls
    // are the same declarations, and the console's preview asks the same set
    // registry the gateway decides with, so it cannot answer differently
    const operations = mcpGatewayOperations({ config, registry, sets, offered: catalog, audit, live, identities: store })
    const console = toHttpHandler(operations)
    const serving = (request: Request): Response | Promise<Response> | undefined =>
      new URL(request.url).pathname === "/mcp-gateway" && request.method === "POST" ? mcp(request) : undefined
    return {
      tools: toEffectTools(operations),
      handle: async (request) => (await console(request)) ?? serving(request) ?? notFound(),
      stop: async () => { store.close(); await upstream.close() },
    }
  },
})
