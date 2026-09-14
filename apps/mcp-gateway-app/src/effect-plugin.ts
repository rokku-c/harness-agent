import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { toEffectTools, toHttpHandler } from "@effect-agent/effect-interface"
import {
  authenticateRequest, buildMcpGatewayServer, makeIdentityStore, makeLiveSets, makeMcpGateway,
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
    const sets = makeLiveSets(context.mcpSets, makeRegistrySetResolver(registry))
    const upstream = makeRegistryHttpUpstream({ registry, fetch: context.fetch })
    const audit = makeAuditLog()
    const store = makeIdentityStore(config.databaseFile)
    const catalog = makeToolCatalog()
    const live = makeLiveCatalog(catalog, upstream, registry)
    const gateway = makeMcpGateway({ setRegistry: sets, upstream, captureArgs: config.captureArgs, recorder: audit })
    const surface: McpToolSurface = {
      gateway, catalog, refresh: live.refresh, tokens: store.tokens, principals: store.principals,
    }
    const mcp = serveMcpHttp(() => Promise.resolve(buildMcpGatewayServer(surface)), {
      authenticate: (request) => authenticateRequest(store, request),
    })
    const operations = mcpGatewayOperations({ registry, sets, offered: catalog, audit, live, identities: store })
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
