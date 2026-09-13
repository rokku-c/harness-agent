import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { toEffectTools, toHttpHandler } from "@effect-agent/effect-interface"
import { makeMcpGateway, buildMcpGatewayServer, makeMcpSetRegistry, makeRegistryHttpUpstream, makeRegistrySetResolver } from "@effect-agent/mcp-gateway"
import { effectConfig } from "./effect-config.ts"
import { makeAuditLog, type AccessConfig } from "./access-audit.ts"
import { mcpGatewayOperations, type GatewaySurfaces } from "./ops.ts"

const notFound = (): Response => Response.json({ ok: false, error: "Not found" }, { status: 404 })

export const createMcpGatewayPlugin = (getConfig: () => unknown, context: AppRuntimeContext): EffectPlugin => ({
  id: "mcp-gateway", priority: 20,
  load: async (): Promise<LoadedPlane> => {
    const registry = context.mcpRegistry
    if (!registry) throw new Error("mcp-gateway requires the shared MCP Registry")
    const config = effectConfig.schema.parse(getConfig()), sets = makeMcpSetRegistry({ resolver: makeRegistrySetResolver(registry) })
    for (const set of config.sets) sets.registerSet(set)
    for (const binding of config.bindings) sets.bindAgent(binding)
    const upstream = makeRegistryHttpUpstream({ registry, fetch: context.fetch }), audit = makeAuditLog()
    const gateway = makeMcpGateway({ setRegistry: sets, upstream, defaultAction: config.defaultAction, captureArgs: config.captureArgs, recorder: audit })
    const mcp = serveMcpHttp(() => Promise.resolve(buildMcpGatewayServer(gateway)))
    // one list, two projections: what the console reads and what an agent calls
    // are the same declarations, so a preview cannot mean two different things
    const operations = mcpGatewayOperations({ config: config as AccessConfig, registry, audit } satisfies GatewaySurfaces)
    const console = toHttpHandler(operations)
    const serving = (request: Request): Response | Promise<Response> | undefined =>
      new URL(request.url).pathname === "/mcp-gateway" && request.method === "POST" ? mcp(request) : undefined
    return {
      tools: toEffectTools(operations),
      handle: async (request) => (await console(request)) ?? serving(request) ?? notFound(),
      stop: () => upstream.close(),
    }
  },
})
