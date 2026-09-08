import type { EffectPlugin, LoadedPlane } from "@effect-agent/effect-host"
import type { AppRuntimeContext } from "@effect-agent/effect-apps"
import { serveMcpHttp } from "@effect-agent/effect-mcp-http"
import { makeMcpGateway, buildMcpGatewayServer, makeMcpSetRegistry, makeRegistryHttpUpstream, makeRegistrySetResolver } from "@effect-agent/mcp-gateway"
import { effectConfig } from "./effect-config.ts"

export const createMcpGatewayPlugin = (getConfig: () => unknown, context: AppRuntimeContext): EffectPlugin => ({
  id: "mcp-gateway", priority: 20,
  load: async (): Promise<LoadedPlane> => {
    const registry = context.mcpRegistry
    if (!registry) throw new Error("mcp-gateway requires the shared MCP Registry")
    const config = effectConfig.schema.parse(getConfig()), sets = makeMcpSetRegistry({ resolver: makeRegistrySetResolver(registry) })
    for (const set of config.sets) sets.registerSet(set)
    for (const binding of config.bindings) sets.bindAgent(binding)
    const upstream = makeRegistryHttpUpstream({ registry, fetch: context.fetch })
    const gateway = makeMcpGateway({ setRegistry: sets, upstream, defaultAction: config.defaultAction, captureArgs: config.captureArgs })
    const mcp = serveMcpHttp(() => Promise.resolve(buildMcpGatewayServer(gateway)))
    const topology = () => ({ servers: registry.list(), sets: config.sets, bindings: config.bindings })
    return {
      tools: [{ name: "mcp_gateway_topology", input: effectConfig.schema.pick({}).strict(), handler: topology }],
      handle: async (request) => {
        const path = new URL(request.url).pathname
        if (path === "/mcp-gateway" && request.method === "GET") return Response.json({ app: "mcp-gateway", ...topology() })
        if (path === "/mcp-gateway" && request.method === "POST") return mcp(request)
        return Response.json({ ok: false, error: "Not found" }, { status: 404 })
      },
      stop: () => upstream.close(),
    }
  },
})
